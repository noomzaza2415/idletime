import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import { shrinkPhoto, type PickedPhoto, type RecordPhoto } from '@/api/photo-store';

/**
 * รูปที่ถ่ายหรือเลือกแล้ว แต่ยังไม่ได้ขึ้น server
 *
 * รูปจากกล้องไม่ได้ลงคลังภาพของเครื่อง ถ้าอัปโหลดล้มแล้วทิ้งไป รูปนั้นหายถาวร
 * และหลักฐานจุดที่หยุดถ่ายซ้ำไม่ได้แล้ว เพราะหน้างานซ่อมเสร็จไปแล้ว
 * จึงคัดลอกไฟล์มาเก็บในโฟลเดอร์ document ของแอปก่อนส่งเสมอ แล้วจดรายการไว้ใน AsyncStorage
 * ไฟล์ใน cache ระบบลบทิ้งเองได้เมื่อพื้นที่ใกล้เต็ม แต่โฟลเดอร์ document ระบบไม่แตะ
 *
 * ไฟล์จะถูกลบก็ต่อเมื่อ server ยืนยันว่าได้รูปแล้ว หรือผู้ใช้กดทิ้งเอง
 */

export interface QueuedPhoto {
  /** id ในเครื่อง ไม่เกี่ยวกับชื่อไฟล์บน server */
  key: string;
  uri: string;
  /** ขนาดไฟล์เป็น byte ใช้จับคู่กับรูปบน server ตอนเช็กว่าเคยส่งถึงแล้วหรือยัง */
  size: number;
  /**
   * เวลาที่ส่งครั้งล่าสุดแล้วไม่รู้ผล (หมดเวลาหรือหลุดตอนรอคำตอบ)
   * มีค่าแปลว่า server อาจได้รูปไปแล้ว ต้องเช็กก่อนส่งซ้ำ
   */
  uncertainAt?: number;
  /**
   * เวลาที่เริ่มส่งรอบปัจจุบัน ถูกล้างเมื่อรู้ผล
   * ถ้าเปิดแอปมาแล้วยังมีค่าค้าง แปลว่าแอปถูกปิดระหว่างส่ง server อาจได้รูปไปแล้ว
   */
  sendingAt?: number;
  /** ข้อความผิดพลาดล่าสุด มีค่าแปลว่ารอให้ผู้ใช้กดส่งใหม่ */
  error?: string;
  cdEquip?: string | null;
}

const QUEUE_PREFIX = 'photoQueue:';

/**
 * รูปค้างนานกว่านี้ทิ้งไป เก็บไว้นานกว่าร่างข้อความ (3 วัน) เพราะรูปคือหลักฐาน
 * แต่ถ้าค้างเป็นสัปดาห์แปลว่าไม่มีใครกลับมาส่งแล้ว ปล่อยไว้ก็กินพื้นที่เครื่องเปล่า ๆ
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * เวลาของ server กับมือถืออาจไม่ตรงกัน ตอนจับคู่รูปจึงยอมให้คลาดได้เท่านี้
 * ใช้คู่กับขนาดไฟล์ที่ต้องตรงกันทุก byte โอกาสจับผิดใบจึงต่ำมาก
 */
const CLOCK_SKEW_MS = 10 * 60 * 1000;

function queueDir() {
  const dir = new Directory(Paths.document, 'photo-queue');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function newKey() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** เวลาที่รูปเข้าคิว อ่านจาก key ที่ขึ้นต้นด้วยเวลาเสมอ */
function queuedAt(item: QueuedPhoto) {
  return parseInt(item.key.slice(0, 8), 36) || 0;
}

async function write(recordId: string, items: QueuedPhoto[]) {
  try {
    if (items.length === 0) await AsyncStorage.removeItem(QUEUE_PREFIX + recordId);
    else await AsyncStorage.setItem(QUEUE_PREFIX + recordId, JSON.stringify(items));
  } catch {
    // จดคิวไม่ลงไม่ควรทำให้การส่งรูปพัง ไฟล์ยังอยู่ในหน่วยความจำของหน้าจอนี้
  }
}

function deleteFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ลบไม่ได้ก็แค่เหลือไฟล์ค้าง ไม่กระทบข้อมูล
  }
}

/** คิวของรายการหนึ่ง ตัดรายการที่ไฟล์หายไปแล้วหรือค้างนานเกินออก */
export async function loadQueue(recordId: string): Promise<QueuedPhoto[]> {
  let items: QueuedPhoto[] = [];
  try {
    const raw = await AsyncStorage.getItem(QUEUE_PREFIX + recordId);
    items = raw ? (JSON.parse(raw) as QueuedPhoto[]) : [];
  } catch {
    return [];
  }
  const now = Date.now();
  const alive = items.filter((item) => {
    const expired = now - queuedAt(item) > MAX_AGE_MS;
    let exists = false;
    try {
      exists = new File(item.uri).exists;
    } catch {
      exists = false;
    }
    if (expired && exists) deleteFile(item.uri);
    return exists && !expired;
  });
  // ส่งค้างจากรอบที่แอปถูกปิด ถือว่าไม่รู้ผล ให้ตัวส่งถาม server ก่อนส่งซ้ำ
  const recovered = alive.map(({ sendingAt, ...item }) =>
    sendingAt ? { ...item, uncertainAt: item.uncertainAt ?? sendingAt } : item
  );
  if (alive.length !== items.length || alive.some((item) => item.sendingAt)) {
    await write(recordId, recovered);
  }
  return recovered;
}

export async function saveQueue(recordId: string, items: QueuedPhoto[]) {
  await write(recordId, items);
}

/**
 * ย่อรูปแล้วคัดลอกเข้าโฟลเดอร์ถาวร คืนรายการที่พร้อมส่ง
 *
 * ถ้าคัดลอกไม่สำเร็จ (เช่นเครื่องเต็ม) ยังใช้ไฟล์เดิมใน cache ส่งต่อได้
 * ดีกว่าไม่ให้แนบรูปเลย เพียงแต่ถ้าส่งล้ม ไฟล์นั้นอาจถูกระบบลบก่อนได้ส่งซ้ำ
 */
export async function stagePhoto(photo: PickedPhoto): Promise<QueuedPhoto> {
  const key = newKey();
  const shrunk = await shrinkPhoto(photo);
  let uri = shrunk;
  try {
    const ext = /\.png($|\?)/i.test(shrunk) ? 'png' : 'jpg';
    const target = new File(queueDir(), `${key}.${ext}`);
    new File(shrunk).copySync(target);
    uri = target.uri;
  } catch (e) {
    console.warn('คัดลอกรูปเข้าคิวไม่สำเร็จ ใช้ไฟล์ใน cache แทน:', e instanceof Error ? e.message : e);
  }
  let size = 0;
  try {
    size = new File(uri).size ?? 0;
  } catch {
    size = 0;
  }
  return { key, uri, size };
}

/** ลบไฟล์ของรูปที่ส่งเสร็จแล้วหรือผู้ใช้กดทิ้ง */
export function discardFile(item: QueuedPhoto) {
  deleteFile(item.uri);
}

/**
 * หารูปบน server ที่น่าจะเป็นใบเดียวกับที่ส่งไปแล้วไม่รู้ผล
 *
 * server เก็บขนาดไฟล์ตามจำนวน byte ที่ได้รับจริง ถ้าขนาดตรงกันทุก byte
 * และถูกบันทึกหลังจากที่เริ่มส่ง ถือว่าเป็นใบเดียวกัน
 * taken คือชื่อไฟล์ที่ถูกจับคู่ไปแล้ว กันไม่ให้รูปสองใบในคิวจับคู่กับรูปบน server ใบเดียวกัน
 */
export function findSavedMatch(
  item: QueuedPhoto,
  serverPhotos: RecordPhoto[],
  taken: Set<string>
): RecordPhoto | undefined {
  if (!item.uncertainAt || item.size <= 0) return undefined;
  return serverPhotos.find(
    (p) =>
      !taken.has(p.fileName) &&
      p.size === item.size &&
      p.createdAt !== undefined &&
      Date.parse(p.createdAt) >= item.uncertainAt! - CLOCK_SKEW_MS
  );
}

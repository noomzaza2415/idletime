import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { NOTIFY_SERVER_URL } from '@/api/config';
import { fetchRead, fetchWithTimeout } from '@/api/http';

/**
 * รูปแนบของรายการ idle time
 *
 * เดิมรูปถูกเก็บเป็น path ในเครื่องผ่าน AsyncStorage ซึ่งอยู่ในโฟลเดอร์ cache ของแอป
 * ระบบปฏิบัติการลบ cache ทิ้งเองได้เมื่อพื้นที่ใกล้เต็ม และเปลี่ยนเครื่องแล้วรูปหายทั้งหมด
 * ตอนนี้จึงอัปโหลดขึ้น notify-server แทน คนอื่นที่เปิดรายการเดียวกันก็เห็นรูปด้วย
 *
 * ที่ไม่ได้ส่งขึ้น API หลักที่พอร์ต 5053 เพราะ service นั้นยังไม่มีเส้นรับไฟล์
 * และซอร์สอยู่กับทีม backend ส่วน notify-server เป็นของโปรเจกต์นี้เองจึงเพิ่มเส้นได้ทันที
 */

const PHOTO_BASE = `${NOTIFY_SERVER_URL}/api/v1/IdleTime/Photos`;

export type RecordPhoto = {
  /** ชื่อไฟล์บน server ใช้เป็น key ตอนลบ เช่น 20260909_142530_1024_a1b2.jpg */
  fileName: string;
  /** ที่อยู่เต็มสำหรับเอาไปแสดงใน <Image> ได้เลย */
  url: string;
  size: number;
  userName: string | null;
  createdAt: string;
};

/** server ตอบ url เป็น path เปล่า ต้องเติมที่อยู่ server ให้ก่อนเอาไปแสดง */
function toAbsolute(photo: RecordPhoto): RecordPhoto {
  return { ...photo, url: `${NOTIFY_SERVER_URL}${photo.url}` };
}

/** อ่านผลลัพธ์ตามรูปแบบเดียวกับ endpoint อื่นของบริการนี้ คือ { isSuccess, result } */
async function readResult<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.isSuccess) {
    throw new Error(body?.errorMessages?.[0] ?? `HTTP ${res.status}`);
  }
  return body.result as T;
}

/** เดา mime type จากนามสกุลไฟล์ server รับเฉพาะ jpg กับ png */
function mimeOf(uri: string) {
  return /\.png($|\?)/i.test(uri) ? 'image/png' : 'image/jpeg';
}

/** ด้านที่ยาวที่สุดของรูปหลังย่อ พอเห็นว่าเครื่องหยุดตรงไหนโดยไม่กินพื้นที่ */
const MAX_EDGE = 1600;

/** รูปที่ได้จาก ImagePicker ใช้ width/height ตัดสินว่าต้องย่อด้านไหน */
export type PickedPhoto = { uri: string; width?: number; height?: number };

/**
 * ย่อรูปก่อนส่งขึ้น server
 *
 * กล้องมือถือรุ่นใหม่ถ่ายมาที่ความละเอียดเต็ม เคยเจอรูปเดียว 9000x12000 pixel ขนาด 6MB
 * ไฟล์ระดับนั้นเปิดด้วย Paint หรือ Photos บน Windows ไม่ขึ้น เพราะต้องกางเป็น bitmap
 * ในหน่วยความจำหลายร้อยเมกะไบต์ ทั้งยังอัปโหลดช้าและกินพื้นที่บน server โดยไม่จำเป็น
 *
 * ค่า quality ของ ImagePicker บีบแค่คุณภาพ ไม่ได้ลดจำนวนพิกเซล จึงต้องย่อเองตรงนี้
 *
 * ถ้าย่อไม่สำเร็จให้ส่งไฟล์เดิมไปแทน ดีกว่าอัปโหลดไม่ได้เลย
 */
async function shrink(photo: PickedPhoto): Promise<string> {
  const { uri, width, height } = photo;
  if (width && height && Math.max(width, height) <= MAX_EDGE) return uri;

  try {
    const context = ImageManipulator.manipulate(uri);
    // ระบุด้านเดียว อีกด้านคำนวณให้เองโดยรักษาสัดส่วนภาพ
    context.resize(height && width && height > width ? { height: MAX_EDGE } : { width: MAX_EDGE });
    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
    return result.uri;
  } catch (e) {
    console.warn('ย่อรูปไม่สำเร็จ ส่งไฟล์เดิมแทน:', e instanceof Error ? e.message : e);
    return uri;
  }
}

export async function getRecordPhotos(recordId: string): Promise<RecordPhoto[]> {
  const res = await fetchRead(`${PHOTO_BASE}/${encodeURIComponent(recordId)}`);
  const photos = await readResult<RecordPhoto[]>(res);
  return photos.map(toAbsolute);
}

/**
 * ส่ง multipart ด้วย XMLHttpRequest ไม่ใช่ fetch
 *
 * Expo SDK 57 เปลี่ยน fetch ไปใช้ตัวใหม่ตามมาตรฐาน WinterCG ซึ่งรับเฉพาะ string
 * กับ Blob เท่านั้น พอส่ง { uri, name, type } แบบเดิมเข้าไปจะโยน
 * "Unsupported FormDataPart implementation" ทันที (ดู expo/src/winter/fetch/convertFormData.ts)
 *
 * XMLHttpRequest ยังเป็นตัวของ React Native อยู่ และอ่านไฟล์จาก uri ส่งให้เองได้
 * จึงไม่ต้องอ่านไฟล์เข้าหน่วยความจำก่อน และไม่ต้องเพิ่ม expo-file-system เข้ามา
 *
 * ห้ามตั้ง header Content-Type เอง ต้องปล่อยให้ XHR ใส่ boundary ให้
 */
function postForm<T>(url: string, form: FormData, onProgress?: (ratio: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    // รายงานความคืบหน้าจริงจากจำนวน byte ที่ส่งไปแล้ว ไม่ใช่แถบหลอกที่วิ่งเอง
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
      };
    }
    // สัญญาณในโรงงานหลุดบ่อย ตั้งเวลาไว้ยาวหน่อยเผื่อรูปหลายใบ
    xhr.timeout = 60_000;
    xhr.onload = () => {
      let body: { isSuccess?: boolean; result?: T; errorMessages?: string[] } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // ตอบกลับไม่ใช่ JSON ปล่อยให้ตกไปที่ error ด้านล่าง
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.isSuccess) {
        resolve(body.result as T);
      } else {
        reject(new Error(body?.errorMessages?.[0] ?? `HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('เชื่อมต่อ server ไม่ได้'));
    xhr.ontimeout = () => reject(new Error('อัปโหลดนานเกินไป'));
    xhr.send(form);
  });
}

/** อัปโหลดรูปเข้ารายการหนึ่ง ส่งได้หลายใบในครั้งเดียว ย่อขนาดให้ก่อนส่งเสมอ */
export async function uploadRecordPhotos(
  recordId: string,
  photos: PickedPhoto[],
  userName?: string | null,
  onProgress?: (ratio: number) => void
): Promise<RecordPhoto[]> {
  const uris = await Promise.all(photos.map(shrink));

  const form = new FormData();
  for (const uri of uris) {
    form.append('files', {
      uri,
      name: uri.split('/').pop() || 'photo.jpg',
      type: mimeOf(uri),
    } as unknown as Blob);
  }
  if (userName) form.append('userName', userName);

  const saved = await postForm<RecordPhoto[]>(
    `${PHOTO_BASE}/${encodeURIComponent(recordId)}`,
    form,
    onProgress
  );
  return saved.map(toAbsolute);
}

/** ส่งชื่อผู้ลบไปด้วย server จดไว้ให้ตามได้ว่าใครลบรูปหลักฐานไป */
export async function deleteRecordPhoto(
  recordId: string,
  fileName: string,
  userName?: string | null
): Promise<void> {
  const res = await fetchWithTimeout(
    `${PHOTO_BASE}/${encodeURIComponent(recordId)}/${encodeURIComponent(fileName)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: userName ?? null }),
    }
  );
  await readResult<string>(res);
}

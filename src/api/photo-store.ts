import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { NOTIFY_SERVER_URL } from '@/api/config';
import { AppError, describeEndpoint } from '@/api/app-error';
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
  size?: number;
  userName?: string | null;
  createdAt?: string;
};

type RecordPhotosResult = {
  recordId: number | string;
  cdEquip: string | null;
  photos: RecordPhoto[];
};

/** server ตอบ url เป็น path เปล่า ต้องเติมที่อยู่ server ให้ก่อนเอาไปแสดง */
function toAbsolute(photo: RecordPhoto): RecordPhoto {
  return { ...photo, url: `${NOTIFY_SERVER_URL}${photo.url}` };
}

/** อ่านผลลัพธ์ตามรูปแบบเดียวกับ endpoint อื่นของบริการนี้ คือ { isSuccess, result } */
async function readResult<T>(res: Response, method: string): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.isSuccess) {
    const endpoint = describeEndpoint(method, res.url);
    const serverMessage = body?.errorMessages?.[0];
    if (res.ok && !body) throw new AppError('BAD_RESPONSE', { status: res.status, endpoint });
    throw res.ok
      ? new AppError('REJECTED', { status: res.status, serverMessage, endpoint })
      : new AppError('HTTP', { status: res.status, serverMessage, endpoint });
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
export async function shrinkPhoto(photo: PickedPhoto): Promise<string> {
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
  const result = await readResult<RecordPhotosResult>(res, 'GET');
  return result.photos.map(toAbsolute);
}

/**
 * อัปโหลดไม่สำเร็จ พร้อมบอกว่า server อาจได้รูปไปแล้วหรือไม่
 *
 * maybeSaved = true คือส่งข้อมูลออกไปครบแล้วแต่ไม่ได้คำตอบกลับ (timeout หรือ wifi หลุดตอนรอคำตอบ)
 * server อาจบันทึกรูปไปแล้ว ก่อนส่งซ้ำต้องเช็กก่อน ไม่งั้นรายการจะได้รูปเดียวกันสองใบ
 * ส่วน server ตอบกลับมาว่าปฏิเสธ หรือต่อไม่ติดตั้งแต่แรก ถือว่ายังไม่ได้รูปแน่นอน
 */
export class PhotoUploadError extends Error {
  readonly maybeSaved: boolean;
  /** server ปฏิเสธด้วยเหตุผลที่ส่งซ้ำก็ไม่ผ่าน เช่น รูปครบเพดานแล้ว ไฟล์ใหญ่เกิน */
  readonly rejected: boolean;

  constructor(message: string, maybeSaved: boolean, rejected = false) {
    super(message);
    this.name = 'PhotoUploadError';
    this.maybeSaved = maybeSaved;
    this.rejected = rejected;
  }
}

/**
 * เวลารอต่อรูปหนึ่งใบ
 *
 * รูปหลังย่อราว 300-600KB ถ้า wifi โรงงานช้าจนใบเดียวยังเกินเวลานี้ รอต่อไปก็ไม่น่าจะสำเร็จ
 * ดีกว่าปล่อยให้ผู้ใช้ยืนดูแถบค้าง รูปที่ล้มยังเก็บอยู่ในเครื่อง กดส่งใหม่ได้
 */
const UPLOAD_TIMEOUT_MS = 45_000;

/**
 * ส่งรูปหนึ่งใบแบบ multipart ด้วย XMLHttpRequest ไม่ใช่ fetch
 *
 * Expo SDK 57 เปลี่ยน fetch ไปใช้ตัวใหม่ตามมาตรฐาน WinterCG ซึ่งรับเฉพาะ string
 * กับ Blob เท่านั้น พอส่ง { uri, name, type } แบบเดิมเข้าไปจะโยน
 * "Unsupported FormDataPart implementation" ทันที (ดู expo/src/winter/fetch/convertFormData.ts)
 *
 * XMLHttpRequest ยังเป็นตัวของ React Native อยู่ และอ่านไฟล์จาก uri ส่งให้เองได้
 * จึงไม่ต้องอ่านไฟล์เข้าหน่วยความจำก่อน
 *
 * ส่งทีละใบแทนการรวมหลายใบใน request เดียว เพราะ wifi หลุดกลางทางจะเสียแค่ใบที่กำลังส่ง
 * ใบที่ส่งเสร็จแล้วอยู่บน server ครบ และไม่ติดเพดาน 10 ไฟล์ต่อครั้งของ server ด้วย
 *
 * ห้ามตั้ง header Content-Type เอง ต้องปล่อยให้ XHR ใส่ boundary ให้
 */
export function uploadRecordPhoto(
  recordId: string,
  uri: string,
  userName?: string | null,
  cdEquip?: string | null,
  onProgress?: (ratio: number) => void
): Promise<RecordPhoto> {
  const form = new FormData();
  form.append('files', {
    uri,
    name: uri.split('/').pop() || 'photo.jpg',
    type: mimeOf(uri),
  } as unknown as Blob);
  if (userName) form.append('userName', userName);
  if (cdEquip) form.append('cdEquip', cdEquip);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    /** ส่งข้อมูลออกไปครบแล้วหรือยัง ใช้ตัดสินว่า server อาจได้รูปไปแล้วหรือไม่ */
    let sentAll = false;
    xhr.open('POST', `${PHOTO_BASE}/${encodeURIComponent(recordId)}`);
    // รายงานความคืบหน้าจริงจากจำนวน byte ที่ส่งไปแล้ว ไม่ใช่แถบหลอกที่วิ่งเอง
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || e.total <= 0) return;
      if (e.loaded >= e.total) sentAll = true;
      onProgress?.(e.loaded / e.total);
    };
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.onload = () => {
      let body: { isSuccess?: boolean; result?: RecordPhotosResult; errorMessages?: string[] } | null =
        null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // ตอบกลับไม่ใช่ JSON ปล่อยให้ตกไปที่ error ด้านล่าง
      }
      const saved = body?.result?.photos[0];
      if (xhr.status >= 200 && xhr.status < 300 && body?.isSuccess && saved) {
        resolve(toAbsolute(saved));
        return;
      }
      // 4xx คือ server อ่านคำขอแล้วปฏิเสธ ส่งซ้ำก็ได้ผลเดิม ส่วน 5xx อาจเป็นชั่วคราว
      const rejected = xhr.status >= 400 && xhr.status < 500;
      reject(
        new PhotoUploadError(body?.errorMessages?.[0] ?? `HTTP ${xhr.status}`, false, rejected)
      );
    };
    xhr.onerror = () =>
      reject(
        new PhotoUploadError(
          sentAll ? 'ขาดการเชื่อมต่อระหว่างรอ server ตอบ' : 'เชื่อมต่อ server ไม่ได้ ตรวจสอบ wifi',
          sentAll
        )
      );
    // หมดเวลาโดยไม่รู้ว่า server รับไปถึงไหน ถือว่าอาจบันทึกแล้วไว้ก่อน
    xhr.ontimeout = () => reject(new PhotoUploadError('ส่งรูปนานเกินไป', true));
    xhr.send(form);
  });
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
  await readResult<string>(res, 'DELETE');
}

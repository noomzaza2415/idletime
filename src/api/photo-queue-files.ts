import { Directory, File, Paths } from 'expo-file-system';

/**
 * ที่เก็บไฟล์รูปในคิวบนมือถือ (เว็บใช้ photo-queue-files.web.ts)
 *
 * ไฟล์ใน cache ระบบลบทิ้งเองได้เมื่อพื้นที่ใกล้เต็ม แต่โฟลเดอร์ document ระบบไม่แตะ
 * จึงคัดลอกรูปที่ย่อแล้วมาไว้ที่นี่ก่อนส่งเสมอ
 */

function queueDir() {
  const dir = new Directory(Paths.document, 'photo-queue');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/**
 * คัดลอกรูปเข้าโฟลเดอร์ถาวร คืนที่อยู่ใหม่กับขนาดไฟล์
 *
 * ถ้าคัดลอกไม่สำเร็จ (เช่นเครื่องเต็ม) ยังใช้ไฟล์เดิมใน cache ส่งต่อได้
 * ดีกว่าไม่ให้แนบรูปเลย เพียงแต่ถ้าส่งล้ม ไฟล์นั้นอาจถูกระบบลบก่อนได้ส่งซ้ำ
 */
export async function persistPhoto(key: string, shrunk: string): Promise<{ uri: string; size: number }> {
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
  return { uri, size };
}

export function photoExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

export function deletePhoto(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // ลบไม่ได้ก็แค่เหลือไฟล์ค้าง ไม่กระทบข้อมูล
  }
}

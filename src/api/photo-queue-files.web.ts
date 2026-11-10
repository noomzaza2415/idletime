/**
 * ที่เก็บไฟล์รูปในคิวบนเว็บ (มือถือใช้ photo-queue-files.ts)
 *
 * browser ไม่มีโฟลเดอร์ document ให้เขียนไฟล์ และ blob: URL ที่ได้จากการเลือกรูป
 * หายทันทีที่รีเฟรชหน้าหรือปิดแท็บ ถ้าเก็บแค่ที่อยู่นั้นไว้ รูปที่ยังส่งไม่ถึงจะหายเงียบ
 * จึงแปลงรูปเป็น data URL ซึ่งเป็นเนื้อรูปทั้งก้อน แล้วให้ photo-queue จดลง AsyncStorage
 * (บนเว็บคือ localStorage) รีเฟรชแล้วยังส่งต่อได้
 *
 * localStorage จุได้ราว 5MB หรือรูปที่ย่อแล้วไม่กี่ใบ ถ้าเขียนไม่ลง photo-queue
 * กลืน error ไว้แล้ว รูปยังอยู่ในหน่วยความจำของแท็บและส่งได้ตามปกติ แค่ไม่รอดการรีเฟรช
 */

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('อ่านไฟล์รูปไม่สำเร็จ'));
    reader.readAsDataURL(blob);
  });
}

/** จำนวน byte ของเนื้อรูปจริง ต้องตรงกับที่ server นับ เพราะใช้จับคู่รูปที่ส่งแล้วไม่รู้ผล */
function dataUrlBytes(uri: string): number {
  const base64 = uri.slice(uri.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export async function persistPhoto(_key: string, shrunk: string): Promise<{ uri: string; size: number }> {
  if (shrunk.startsWith('data:')) return { uri: shrunk, size: dataUrlBytes(shrunk) };
  try {
    const blob = await (await fetch(shrunk)).blob();
    const uri = await readAsDataUrl(blob);
    return { uri, size: blob.size };
  } catch (e) {
    console.warn('แปลงรูปเป็น data URL ไม่สำเร็จ ใช้ที่อยู่เดิมแทน:', e instanceof Error ? e.message : e);
    return { uri: shrunk, size: 0 };
  }
}

/** มีแต่ data URL ที่ยังใช้ได้หลังรีเฟรช ที่อยู่แบบอื่นถือว่าไฟล์หายไปแล้ว */
export function photoExists(uri: string): boolean {
  return uri.startsWith('data:');
}

export function deletePhoto(uri: string) {
  // data URL ไม่มีไฟล์ให้ลบ ข้อมูลหายไปพร้อมรายการในคิว
  if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
}

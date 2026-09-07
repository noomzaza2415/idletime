import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * เก็บ path รูปของแต่ละรายการไว้ในเครื่อง (แนบได้หลายรูปต่อ 1 รายการ)
 *
 * ยังเก็บขึ้น backend ไม่ได้ เพราะ API ของ Idle Time ไม่มี field สำหรับรูป
 * และยังไม่มี endpoint อัปโหลด — รูปจึงอยู่เฉพาะบนเครื่องที่ถ่าย
 * เมื่อได้ endpoint แล้วให้เปลี่ยนมาอัปโหลดแล้วเก็บ URL ที่ได้แทน
 */
const key = (recordId: string) => `recordPhotos:${recordId}`;

export async function getRecordPhotos(recordId: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(key(recordId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    // ข้อมูลเสียหาย — ถือว่ายังไม่มีรูป ดีกว่าทำให้หน้าจอพัง
    return [];
  }
}

export async function setRecordPhotos(recordId: string, uris: string[]): Promise<void> {
  if (uris.length === 0) {
    await AsyncStorage.removeItem(key(recordId));
    return;
  }
  await AsyncStorage.setItem(key(recordId), JSON.stringify(uris));
}

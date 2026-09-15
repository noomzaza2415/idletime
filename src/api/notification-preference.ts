import AsyncStorage from '@react-native-async-storage/async-storage';

import { saveDeviceToFirestore } from '@/api/firestore-device';
import { registerForPushNotifications } from '@/api/push-notifications';

/**
 * สวิตช์ปิด/เปิดการแจ้งเตือนของเครื่องนี้
 *
 * ปิดที่ต้นทางคือหยุดไม่ให้ server ส่ง push มาเลย โดยตั้ง active เป็น false
 * ในเอกสารของเครื่องนี้บน Firestore ซึ่ง notify-server กรองด้วย where('active','==',true)
 * อยู่แล้ว วิธีนี้จึงเงียบจริงแม้ปิดแอปไปแล้ว ต่างจากการปิดที่ฝั่งแอปซึ่งได้ผลเฉพาะ
 * ตอนแอปยังรันอยู่ และแจ้งเตือนก็ยังเด้งขึ้นหน้าจอล็อกเหมือนเดิม
 *
 * ค่าที่เลือกไว้เก็บใน AsyncStorage ด้วย เพราะตอนเปิดแอปครั้งถัดไปจะมีการเขียน
 * เอกสารเครื่องนี้ทับเพื่อต่ออายุ token ถ้าไม่จำค่าไว้ การเขียนทับนั้นจะเปิด
 * การแจ้งเตือนกลับมาเองโดยที่ผู้ใช้ไม่ได้สั่ง
 */

const ENABLED_KEY = 'notificationsEnabled';

/** ยังไม่เคยตั้งค่า = เปิดไว้ ให้พฤติกรรมเหมือนเดิมกับเครื่องที่อัปเดตแอปมา */
export async function getNotificationsEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) !== 'false';
  } catch {
    return true;
  }
}

/**
 * เปลี่ยนสถานะแล้วแจ้งให้ Firestore รู้ทันที
 *
 * เก็บค่าลงเครื่องก่อนเสมอ แม้การเขียน Firestore จะล้มเหลว เพื่อให้สวิตช์ที่ผู้ใช้
 * กดค้างอยู่ตามที่กด แล้วรอบหน้าที่เปิดแอปจะมีการเขียนค่านี้ขึ้นไปอีกครั้งเอง
 *
 * ต้องส่ง userName เข้ามาด้วยเพราะกฎความปลอดภัยของ Firestore ห้ามแอปอ่านเอกสาร
 * ของตัวเองกลับมา จึงเขียนทับทั้งชุดทุกครั้ง ไม่มีทางแก้เฉพาะฟิลด์ active
 *
 * @returns true เมื่อ Firestore รับค่าใหม่แล้ว คือมีผลกับ push จริง
 */
export async function setNotificationsEnabled(
  enabled: boolean,
  userName: string | null
): Promise<boolean> {
  try {
    await AsyncStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // เขียนลงเครื่องไม่ได้ก็ยังพยายามบอก Firestore ต่อ อย่างน้อยรอบนี้จะเงียบให้
  }

  const token = await registerForPushNotifications();
  if (!token) return false;

  return saveDeviceToFirestore(token, userName, enabled);
}

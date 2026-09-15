import AsyncStorage from '@react-native-async-storage/async-storage';

import { saveDeviceToFirestore } from '@/api/firestore-device';
import { getExistingPushToken, registerForPushNotifications } from '@/api/push-notifications';
import { unregisterDeviceToken } from '@/api/register-device';

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

/**
 * ค้างไว้ว่ายังต้องปิดแจ้งเตือนของเครื่องนี้ เพราะตอนออกจากระบบส่งไม่สำเร็จ
 *
 * ถ้าไม่จำไว้ เครื่องที่ออกจากระบบตอนเน็ตหลุดจะได้แจ้งเตือนชื่อไลน์และ WO ต่อไปเรื่อย ๆ
 * ทั้งที่ไม่มีใครล็อกอินอยู่ ซึ่งเกิดได้จริงเมื่อเครื่องเปลี่ยนมือหรือลีดเดอร์ย้ายไลน์
 */
const PENDING_DEACTIVATE_KEY = 'pushDeactivatePending';

/**
 * ปิดแจ้งเตือนของเครื่องนี้ที่ต้นทาง ทั้ง Firestore และไฟล์ของ notify-server
 *
 * ต้องทำทั้งสองที่ เพราะเครื่องอาจลงทะเบียนไว้ทางใดทางหนึ่ง (ดู use-new-record-alert)
 * สำเร็จทางใดทางหนึ่งก็ถือว่าจบ เพราะอีกทางอาจไม่เคยมีข้อมูลเครื่องนี้อยู่แล้ว
 */
export async function retryPendingDeactivation(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(PENDING_DEACTIVATE_KEY)) !== 'true') return;

    const token = await getExistingPushToken();
    // ไม่มีสิทธิ์แจ้งเตือนหรือไม่ใช่เครื่องจริง แปลว่าเครื่องนี้แสดงแจ้งเตือนไม่ได้อยู่แล้ว
    if (!token) {
      await AsyncStorage.removeItem(PENDING_DEACTIVATE_KEY);
      return;
    }

    const [cloud, local] = await Promise.all([
      saveDeviceToFirestore(token, null, false),
      unregisterDeviceToken(token),
    ]);
    if (cloud || local) await AsyncStorage.removeItem(PENDING_DEACTIVATE_KEY);
  } catch {
    // ค้างไว้ให้รอบเปิดแอปครั้งหน้าลองใหม่
  }
}

/**
 * เรียกตอนออกจากระบบ
 *
 * จดไว้ก่อนแล้วค่อยส่ง จะได้ไม่หายถ้าแอปถูกปิดกลางคัน ผู้เรียกไม่ควร await
 * เพราะการออกจากระบบต้องเสร็จทันทีแม้เน็ตหลุด
 */
export async function deactivateDeviceOnLogout(): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_DEACTIVATE_KEY, 'true');
  } catch {
    // จดไม่ได้ก็ยังพยายามส่งรอบนี้
  }
  await retryPendingDeactivation();
}

/**
 * ล้างงานที่ค้าง เรียกตอนล็อกอินสำเร็จ
 * ไม่งั้นรอบเปิดแอปครั้งหน้าจะไปปิดแจ้งเตือนของผู้ใช้ที่เพิ่งล็อกอินเข้ามา
 */
export async function clearPendingDeactivation(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_DEACTIVATE_KEY);
  } catch {
    // ไม่มีผลกับการใช้งาน
  }
}

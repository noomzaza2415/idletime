import AsyncStorage from '@react-native-async-storage/async-storage';

import { saveDeviceToFirestore } from '@/api/firestore-device';
import { getExistingPushToken } from '@/api/push-notifications';
import { unregisterDeviceToken } from '@/api/register-device';

/**
 * การแจ้งเตือนของเครื่องนี้ เปิดเสมอระหว่างที่มีคนล็อกอิน และปิดที่ต้นทางตอนออกจากระบบ
 *
 * แอปรุ่นก่อนมีสวิตช์ให้ผู้ใช้ปิดเอง ตอนนี้เอาออกแล้วเพื่อไม่ให้ลีดเดอร์พลาดรายการหยุด
 */

/** ค่าของสวิตช์เดิมที่อาจค้างอยู่ในเครื่องที่อัปเดตแอปมา */
const LEGACY_ENABLED_KEY = 'notificationsEnabled';

/** ลบค่าสวิตช์เดิมทิ้ง ไม่มีใครอ่านแล้ว แต่ไม่ควรค้างไว้ให้คนมาเปิดใช้ซ้ำโดยไม่ตั้งใจ */
export async function clearLegacyNotificationSwitch(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEGACY_ENABLED_KEY);
  } catch {
    // ไม่มีผลกับการใช้งาน
  }
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

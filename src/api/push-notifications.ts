/**
 * การแจ้งเตือนของแอป Idle Time Tracker
 *
 * ใช้ push จาก backend ทางเดียว เพราะทำงานแม้ปิดแอปไปแล้ว
 * แอปจึงมีหน้าที่แค่ส่ง push token ไปให้ backend เก็บไว้ และขอสิทธิ์แจ้งเตือน
 *
 * หนึ่งเหตุการณ์ยิงแจ้งเตือนรอบเดียว ไม่มีการเตือนซ้ำทั้งฝั่งแอปและฝั่ง server
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * ปลายทางที่จะเปิดเมื่อผู้ใช้กดแจ้งเตือน
 * ถ้ามี recordId จะพาไปหน้ากรอกสาเหตุของรายการนั้นเลย ไม่ต้องไล่หาเองในลิสต์
 */
export interface NotificationTarget {
  recordId?: string;
  date?: string;
  [key: string]: unknown;
}

/** ช่องแจ้งเตือนของ Android — ต้องสร้างก่อน ไม่งั้นจะไม่มีเสียงและเด้งไม่ขึ้น */
const CHANNEL_ID = 'idle-time-alerts';

/**
 * แสดง banner ทับหน้าจอแม้ตอนที่เปิดแอปค้างอยู่
 * ค่าเริ่มต้นของ expo-notifications จะเงียบไปเลยเมื่อแอปอยู่ foreground
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Idle Time alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

/**
 * ขอสิทธิ์แจ้งเตือน แยกจากการขอ push token โดยตั้งใจ
 *
 * Android 13 ขึ้นไปต้องมี POST_NOTIFICATIONS ถึงจะแสดงแจ้งเตือนได้ รวมถึง local notification
 * ถ้าผูกการขอสิทธิ์ไว้กับการขอ push token เครื่องที่ไม่มี Google Play services
 * จะไม่ถูกถามสิทธิ์เลย แล้วการแจ้งเตือนแบบตั้งเวลาเองก็จะเงียบไปด้วยทั้งที่ควรใช้ได้
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;

  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * FCM token ของเครื่องนี้โดยไม่ขอสิทธิ์เพิ่ม
 *
 * ใช้ตอนออกจากระบบ ซึ่งไม่ควรมีหน้าต่างขอสิทธิ์แจ้งเตือนเด้งขึ้นมา
 * ถ้ายังไม่เคยให้สิทธิ์ เครื่องนี้ก็แสดงแจ้งเตือนไม่ได้อยู่แล้ว จึงคืน null ได้เลย
 */
export async function getExistingPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return null;
  const token = await Notifications.getDevicePushTokenAsync();
  return String(token.data);
}

/**
 * คืน FCM token ให้เอาไปฝากไว้ที่ notify-server สำหรับยิง push ตอนปิดแอป
 * คืน null ถ้าไม่ได้รับสิทธิ์ หรือรันบน emulator ที่ขอ token ไม่ได้
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  // เฉพาะ push token เท่านั้นที่ต้องเครื่องจริง — local notification ใช้ได้ทุกที่
  if (!Device.isDevice) return null;

  // ใช้ token ของ FCM ตรง ๆ เพราะ notify-server ยิงผ่าน Firebase ไม่ได้ผ่าน Expo push service
  const token = await Notifications.getDevicePushTokenAsync();
  return String(token.data);
}

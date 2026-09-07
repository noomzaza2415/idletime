/**
 * การแจ้งเตือนของแอป Idle Time Tracker
 *
 * มีสองเส้นทางที่เสริมกัน:
 *  1. Push จาก backend — ทำงานแม้ปิดแอปไปแล้ว ต้องส่ง Expo push token ไปให้ backend เก็บไว้
 *  2. Local notification — แอปตั้งเวลาเอง ใช้ยิงรอบที่สองหลังจากรอบแรก 30 วินาที
 *
 * เหตุที่รอบสองตั้งจากเครื่องแทนที่จะให้ backend ยิงซ้ำ เพราะไม่ต้องแก้ฝั่ง backend
 * และเวลาห่างแม่นกว่า ไม่ขึ้นกับคิวของ push service
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** ระยะห่างก่อนแจ้งเตือนซ้ำรอบที่สอง */
export const REPEAT_DELAY_SECONDS = 30;

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
    sound: 'default',
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
 * คืน Expo push token ให้เอาไปฝากไว้ที่ backend สำหรับยิง push ตอนปิดแอป
 * คืน null ถ้าไม่ได้รับสิทธิ์ หรือรันบน emulator ที่ขอ token ไม่ได้
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  // เฉพาะ push token เท่านั้นที่ต้องเครื่องจริง — local notification ใช้ได้ทุกที่
  if (!Device.isDevice) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

/**
 * แจ้งเตือนทันที แล้วตั้งอีกรอบห่างไป 30 วินาที ตามที่กำหนดไว้
 * ใช้ตอนแอปตรวจเจอข้อมูลใหม่เอง และตอนได้รับ push จาก backend
 */
export async function notifyNewRecordsTwice(title: string, body: string): Promise<void> {
  await ensureAndroidChannel();

  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: null,
  });

  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: REPEAT_DELAY_SECONDS,
      channelId: CHANNEL_ID,
    },
  });
}

/**
 * ตั้งเฉพาะรอบที่สอง ใช้ตอนที่รอบแรกมาจาก push ของ backend อยู่แล้ว
 * จะได้ไม่ยิงซ้ำซ้อนกับที่ผู้ใช้เพิ่งเห็นไป
 */
export async function scheduleRepeatAfterPush(title: string, body: string): Promise<void> {
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: REPEAT_DELAY_SECONDS,
      channelId: CHANNEL_ID,
    },
  });
}

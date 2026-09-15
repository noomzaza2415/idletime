import { Platform } from 'react-native';

import { ENDPOINTS, NOTIFY_SERVER_URL, PUSH_TOKEN_REGISTRATION_ENABLED } from '@/api/config';
import { fetchWithTimeout } from '@/api/http';

/**
 * ส่ง FCM token ให้บริการแจ้งเตือนเก็บไว้ เพื่อให้ยิง push มาหาเครื่องนี้ได้แม้ปิดแอป
 *
 * ล้มเหลวแบบเงียบโดยตั้งใจ — ถ้า backend ยังไม่พร้อมหรือเน็ตหลุด ผู้ใช้ยังต้องใช้แอปได้ตามปกติ
 * การแจ้งเตือนถือเป็นของเสริม ไม่ควรทำให้หน้าจอหลักพัง
 */
export async function registerDeviceToken(token: string, userName: string | null): Promise<void> {
  if (!PUSH_TOKEN_REGISTRATION_ENABLED) return;

  try {
    await fetchWithTimeout(`${NOTIFY_SERVER_URL}${ENDPOINTS.registerPushToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform: Platform.OS, userName }),
    });
  } catch {
    // เงียบไว้ตามเหตุผลด้านบน
  }
}

/**
 * ขอให้บริการแจ้งเตือนเลิกส่งมาที่เครื่องนี้ ใช้ตอนออกจากระบบ
 * @returns true เมื่อ server รับทราบแล้ว ผู้เรียกจะได้รู้ว่าต้องลองใหม่ภายหลังหรือไม่
 */
export async function unregisterDeviceToken(token: string): Promise<boolean> {
  if (!PUSH_TOKEN_REGISTRATION_ENABLED) return false;

  try {
    const res = await fetchWithTimeout(`${NOTIFY_SERVER_URL}${ENDPOINTS.unregisterPushToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

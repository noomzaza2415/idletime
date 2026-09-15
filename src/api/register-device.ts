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

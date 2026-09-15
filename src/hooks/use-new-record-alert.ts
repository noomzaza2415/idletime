import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';

import { registerForPushNotifications, type NotificationTarget } from '@/api/push-notifications';
import { saveDeviceToFirestore } from '@/api/firestore-device';
import { getNotificationsEnabled } from '@/api/notification-preference';
import { registerDeviceToken } from '@/api/register-device';
import type { IdleTimeRecord } from '@/types';

/** ความถี่ในการถามข้อมูลใหม่ขณะเปิดหน้ารายการค้างไว้ */
export const POLL_INTERVAL_MS = 30_000;

interface Options {
  /** ดึงรายการล่าสุดของกะที่กำลังดูอยู่ */
  fetchLatest: () => Promise<IdleTimeRecord[]>;
  /** ชื่อผู้ใช้ที่ล็อกอินอยู่ ส่งไปให้ backend ผูกกับ token */
  userName: string | null;
  /** หยุด polling เมื่อออกจากหน้าจอ */
  enabled: boolean;
  buildMessage: (count: number) => { title: string; body: string };
}

/**
 * เฝ้าดูรายการใหม่เพื่อขึ้นแถบแจ้งในแอป และพาไปหน้ากรอกเมื่อกดแจ้งเตือน
 *
 * ตัวแจ้งเตือนจริงเป็นหน้าที่ของ notify-server ทั้งหมด และยิงรอบเดียวต่อหนึ่งเหตุการณ์
 * เพราะ listener ฝั่งแอปทำงานเฉพาะตอนแอปยังรันอยู่ ผู้ใช้ที่ปิดแอปจะไม่ได้รับ
 *
 * hook นี้จึงเหลือหน้าที่แค่นับรายการใหม่ไว้ขึ้นแถบสีน้ำเงินตอนเปิดแอปค้างอยู่
 * ถ้าให้ยิงแจ้งเตือนเองด้วยจะซ้ำกับ push ที่ server ส่งมา
 */
export function useNewRecordAlert({ fetchLatest, userName, enabled, buildMessage }: Options) {
  const router = useRouter();
  const seenIds = useRef<Set<string> | null>(null);
  const [newCount, setNewCount] = useState(0);

  const dismiss = useCallback(() => setNewCount(0), []);

  /** ตั้งฐานเปรียบเทียบใหม่ เรียกเมื่อเปลี่ยนไลน์หรือเปลี่ยนวัน */
  const resetBaseline = useCallback((records: IdleTimeRecord[]) => {
    seenIds.current = new Set(records.map((r) => r.id));
    setNewCount(0);
  }, []);

  // ขอสิทธิ์และส่ง push token ให้ backend ครั้งเดียวตอนเข้าใช้งาน
  useEffect(() => {
    // userName เป็น null ได้แค่ช่วงกำลังออกจากระบบ ซึ่งหน้าจอยังไม่ถูกถอดออก
    // ถ้าลงทะเบียนรอบนี้จะเปิดแจ้งเตือนกลับมาทับการปิดตอน logout พอดี
    if (!userName) return;

    let cancelled = false;
    (async () => {
      const token = await registerForPushNotifications();
      if (cancelled || !token) return;

      // เคารพสวิตช์ปิดแจ้งเตือนที่ผู้ใช้เคยกดไว้ ไม่งั้นการเขียนทับรอบนี้
      // จะตั้ง active กลับเป็น true แล้วแจ้งเตือนกลับมาเองทุกครั้งที่เปิดแอป
      const enabled = await getNotificationsEnabled();

      // เขียนลง Firestore ก่อน เพราะทำได้จากเน็ตอะไรก็ได้ ไม่ต้องอยู่วง LAN
      const savedToCloud = await saveDeviceToFirestore(token, userName, enabled);

      // ยิงไปที่ notify-server ด้วยเมื่อ Firestore ไม่สำเร็จ เผื่อยังไม่ได้เปิดใช้ Firestore
      // ข้ามเมื่อผู้ใช้ปิดแจ้งเตือนไว้ เพราะ endpoint นั้นตั้ง active เป็น true เสมอ
      if (!savedToCloud && enabled) await registerDeviceToken(token, userName);
    })();
    return () => {
      cancelled = true;
    };
  }, [userName]);

  /** กดแจ้งเตือนแล้วเปิดหน้ากรอกสาเหตุของรายการนั้นเลย ถ้าแจ้งเตือนระบุ recordId มาด้วย */
  const openFromNotification = useCallback(
    (response: Notifications.NotificationResponse) => {
      const target = response.notification.request.content.data as NotificationTarget | undefined;
      if (!target?.recordId) return;
      router.push({
        pathname: '/record/[id]',
        params: { id: String(target.recordId), date: target.date ? String(target.date) : undefined },
      });
    },
    [router]
  );

  useEffect(() => {
    // กรณีแอปถูกปิดสนิทแล้วเปิดขึ้นมาจากการกดแจ้งเตือน ต้องอ่านย้อนหลังเอง
    // เพราะ listener ด้านล่างผูกไม่ทันตอนที่ระบบส่ง response เข้ามา
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openFromNotification(response);
    });

    const sub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => sub.remove();
  }, [openFromNotification]);

  // ถามข้อมูลใหม่เป็นระยะขณะเปิดหน้าค้างไว้
  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(async () => {
      try {
        const latest = await fetchLatest();
        const baseline = seenIds.current;
        if (!baseline) {
          seenIds.current = new Set(latest.map((r) => r.id));
          return;
        }

        const fresh = latest.filter((r) => !baseline.has(r.id));
        if (fresh.length === 0) return;

        for (const r of fresh) baseline.add(r.id);
        setNewCount((prev) => prev + fresh.length);
      } catch {
        // เน็ตสะดุดชั่วคราวไม่ต้องทำอะไร รอบหน้าค่อยลองใหม่
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [enabled, fetchLatest, buildMessage]);

  return { newCount, dismiss, resetBaseline };
}

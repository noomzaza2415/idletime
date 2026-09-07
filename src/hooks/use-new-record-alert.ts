import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  notifyNewRecordsTwice,
  registerForPushNotifications,
  scheduleRepeatAfterPush,
} from '@/api/push-notifications';
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
 * เฝ้าดูรายการใหม่แล้วแจ้งเตือนสองรอบห่างกัน 30 วินาที
 *
 * ครอบคลุมสองกรณี:
 *  - แอปเปิดค้างอยู่ — hook นี้ poll เองแล้วเทียบ id ที่เคยเห็น
 *  - แอปถูกปิด — backend ยิง push มา พอผู้ใช้เห็นรอบแรกแล้ว hook ตั้งรอบสองต่อให้
 *
 * รอบแรกหลังเปิดแอปจะไม่แจ้งเตือน เพราะทุกรายการยังนับเป็นของใหม่หมด
 * ต้องเก็บเป็นฐานเปรียบเทียบไว้ก่อน ไม่งั้นจะเด้งรัวทุกครั้งที่เปิด
 */
export function useNewRecordAlert({ fetchLatest, userName, enabled, buildMessage }: Options) {
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
    let cancelled = false;
    (async () => {
      const token = await registerForPushNotifications();
      if (!cancelled && token) await registerDeviceToken(token, userName);
    })();
    return () => {
      cancelled = true;
    };
  }, [userName]);

  // push ที่ backend ยิงมาถือเป็นรอบแรก แล้วตั้งรอบสองต่อจากตรงนั้น
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content;
      void scheduleRepeatAfterPush(title ?? '', body ?? '');
    });
    return () => sub.remove();
  }, []);

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

        const { title, body } = buildMessage(fresh.length);
        await notifyNewRecordsTwice(title, body);
      } catch {
        // เน็ตสะดุดชั่วคราวไม่ต้องทำอะไร รอบหน้าค่อยลองใหม่
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [enabled, fetchLatest, buildMessage]);

  return { newCount, dismiss, resetBaseline };
}

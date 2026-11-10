import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { presenceHeartbeat, presenceRelease, subscribePresence } from '@/api/presence';

/** ส่ง heartbeat ทุกเท่านี้ขณะถือล็อก (server ปล่อยล็อกเมื่อเงียบเกิน 90 วินาที) */
const HOLD_INTERVAL_MS = 15_000;
/** ขณะถูกล็อก ถามถี่กว่า จะได้แก้ได้เร็วหลังอีกคนออก */
const WAIT_INTERVAL_MS = 8_000;

export type RecordLock =
  /** ยังไม่รู้ผลรอบแรก หรือติดต่อ server ไม่ได้ ให้แก้ได้ตามปกติ */
  | { status: 'free' }
  /** เครื่องนี้ถือล็อกอยู่ */
  | { status: 'mine' }
  /** เครื่องอื่นกำลังกรอกอยู่ ดูได้อย่างเดียว */
  | { status: 'locked'; holder: string };

/**
 * จองสิทธิ์กรอกรายการนี้ไว้ตลอดที่เปิดหน้ากรอก และปล่อยเมื่อออก
 *
 * ล้มแบบเปิด: server ไม่ตอบถือว่าไม่ล็อก เพราะการบันทึกสาเหตุสำคัญกว่าการกันชน
 * และหน้ากรอกมีตัวตรวจแก้ชนตอนบันทึกอยู่แล้วเป็นด่านสุดท้าย
 *
 * ไม่ปล่อยล็อกตอนแอปไปอยู่เบื้องหลัง เพราะการเปิดกล้องถ่ายรูปก็ทำให้แอปไปอยู่เบื้องหลัง
 * ถ้าปล่อยตอนนั้น อีกคนจะแย่งไปกลางทาง กลับมาแล้วงานที่กรอกค้างไว้บันทึกไม่ได้
 */
export function useRecordLock(
  recordId: string | undefined,
  date: string,
  userName: string | null,
): RecordLock {
  const [lock, setLock] = useState<RecordLock>({ status: 'free' });

  /** เคยได้ล็อกในหน้านี้ไหม ใช้ตัดสินว่าตอนออกต้องสั่งปล่อย */
  const held = useRef(false);

  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    /** สถานะล่าสุด ใช้ตัดสินว่าข้อความจากท่อเรียลไทม์ต้องถามซ้ำหรือไม่ */
    let lastStatus: RecordLock['status'] = 'free';

    const beat = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      const res = await presenceHeartbeat(date, recordId, userName);
      inFlight = false;
      if (cancelled) return;

      let next: RecordLock;
      if (!res) next = { status: 'free' };
      else if (res.granted) next = { status: 'mine' };
      else next = { status: 'locked', holder: res.holder?.userName ?? '-' };

      lastStatus = next.status;
      if (next.status === 'mine') held.current = true;
      setLock((prev) =>
        prev.status === next.status &&
        (prev.status !== 'locked' || prev.holder === (next as { holder: string }).holder)
          ? prev
          : next,
      );

      if (timer) clearTimeout(timer);
      timer = setTimeout(
        () => void beat(),
        next.status === 'locked' ? WAIT_INTERVAL_MS : HOLD_INTERVAL_MS,
      );
    };

    void beat();
    /*
      ขณะถูกล็อก ฟังท่อเรียลไทม์ไว้ด้วย พออีกคนออก (รายการนี้หายจากรายการล็อก) จองทันที
      ไม่ต้องรอรอบถาม 8 วินาที ข้อความจากท่อไม่รวมเครื่องนี้เอง ตอนเราถือล็อกจึงไม่ทำอะไร
    */
    const unsubscribe = subscribePresence(date, (editing) => {
      if (lastStatus === 'locked' && !editing.has(recordId)) void beat();
    });
    // กลับจากกล้องหรือสลับแอป ต่ออายุทันที ไม่รอรอบถัดไป เผื่อ timer ถูกพักไว้ตอนอยู่เบื้องหลัง
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void beat();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sub.remove();
      unsubscribe();
      if (held.current) {
        held.current = false;
        void presenceRelease(date, recordId);
      }
    };
  }, [recordId, date, userName]);

  return lock;
}

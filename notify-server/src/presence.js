/**
 * ล็อก "มีคนกำลังกรอกรายการนี้อยู่" ของหน้ากรอกสาเหตุ
 *
 * ผู้ใช้กำหนดให้ล็อก (2026-11-10): คนแรกที่เปิดหน้ากรอกได้สิทธิ์แก้ คนที่เปิดตามมาดูได้อย่างเดียว
 * จนกว่าคนแรกจะออกหรือหายไปนานเกิน TTL
 *
 * เก็บในหน่วยความจำอย่างเดียว ไม่ลงไฟล์ server restart แล้วล็อกหายทั้งหมดก็ไม่เสียหาย
 * เพราะเครื่องที่ยังเปิดหน้ากรอกอยู่จะส่ง heartbeat มาจองใหม่ภายในรอบถัดไป
 *
 * ตัวตนของผู้ถือล็อกคือ deviceId (สุ่มเก็บไว้ในเครื่อง) ไม่ใช่ชื่อผู้ใช้
 * คนเดียวกันเปิดสองเครื่องก็ถือว่าเป็นสองคน ไม่งั้นสองเครื่องจะเขียนทับกันเองได้
 */

/** ไม่ได้ heartbeat นานเกินเท่านี้ถือว่าออกไปแล้ว เผื่อช่วงเปิดกล้องถ่ายรูปที่แอปไปอยู่เบื้องหลัง */
export const PRESENCE_TTL_MS = 90_000;

/** กันเครื่องที่ผิดปกติยิงคีย์มั่วจน memory บวม รายการที่กรอกพร้อมกันจริงมีไม่ถึงหลักร้อย */
export const PRESENCE_MAX_ENTRIES = 2000;

const MAX_FIELD = 200;

/** คีย์เดียวกันทั้ง server และแอป: วันที่กะ + id รายการ */
export function presenceKey(date, recordId) {
  return `${date}|${recordId}`;
}

/** ตรวจค่าที่ส่งมา คืน null เมื่อใช้ไม่ได้ */
export function cleanField(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const s = String(value).trim();
  return s.length > 0 && s.length <= MAX_FIELD ? s : null;
}

export class PresenceStore {
  /**
   * @param {{ ttlMs?: number, maxEntries?: number, now?: () => number, onChange?: (date: string) => void }} [options]
   *   onChange ถูกเรียกทุกครั้งที่ผู้ถือล็อกของวันนั้นเปลี่ยน (จอง ปล่อย หมดอายุ)
   *   ไม่เรียกตอนต่ออายุ เพราะหน้ารายการไม่ต้องรู้ ไม่งั้นทุกเครื่องได้ข้อความทุก 15 วินาทีต่อคนที่กรอก
   */
  constructor({
    ttlMs = PRESENCE_TTL_MS,
    maxEntries = PRESENCE_MAX_ENTRIES,
    now = Date.now,
    onChange = () => {},
  } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
    this.onChange = onChange;
    /** @type {Map<string, { date: string, recordId: string, deviceId: string, userName: string, since: number, seen: number }>} */
    this.locks = new Map();
  }

  /**
   * ลบล็อกที่หมดอายุ เรียกก่อนอ่านทุกครั้ง และจาก timer ของ server (sweep)
   * แจ้ง onChange ของวันที่มีล็อกหลุด ป้ายบนหน้ารายการจะหายเองโดยไม่ต้องรอใครมาถาม
   */
  prune() {
    const cutoff = this.now() - this.ttlMs;
    const changed = new Set();
    for (const [key, lock] of this.locks) {
      if (lock.seen < cutoff) {
        this.locks.delete(key);
        changed.add(lock.date);
      }
    }
    for (const date of changed) this.onChange(date);
  }

  /**
   * จองหรือต่ออายุล็อก
   * @returns {{ granted: boolean, holder: { userName: string, since: number } | null }}
   *   granted = true เมื่อเครื่องนี้ถือล็อก, false เมื่อมีเครื่องอื่นถืออยู่ (holder บอกว่าใคร)
   *   holder = null เมื่อจองไม่ได้เพราะ store เต็ม (ให้แอปปล่อยแก้ได้ ไม่ล็อกคนไม่ผิด)
   */
  heartbeat(date, recordId, deviceId, userName) {
    this.prune();
    const key = presenceKey(date, recordId);
    const now = this.now();
    const current = this.locks.get(key);

    if (current && current.deviceId !== deviceId) {
      return { granted: false, holder: { userName: current.userName, since: current.since } };
    }
    if (current) {
      current.seen = now;
      const renamed = current.userName !== userName;
      current.userName = userName;
      if (renamed) this.onChange(date);
      return { granted: true, holder: { userName, since: current.since } };
    }
    if (this.locks.size >= this.maxEntries) {
      return { granted: true, holder: null };
    }
    this.locks.set(key, { date, recordId, deviceId, userName, since: now, seen: now });
    this.onChange(date);
    return { granted: true, holder: { userName, since: now } };
  }

  /** ปล่อยล็อก ปล่อยได้เฉพาะเครื่องที่ถืออยู่ */
  release(date, recordId, deviceId) {
    const key = presenceKey(date, recordId);
    const current = this.locks.get(key);
    if (!current || current.deviceId !== deviceId) return false;
    this.locks.delete(key);
    this.onChange(date);
    return true;
  }

  /** ล็อกที่ยังมีผลของวันที่ระบุ ใช้แสดงป้ายบนหน้ารายการ */
  list(date) {
    this.prune();
    const result = [];
    for (const lock of this.locks.values()) {
      if (lock.date !== date) continue;
      result.push({
        recordId: lock.recordId,
        deviceId: lock.deviceId,
        userName: lock.userName,
        since: lock.since,
      });
    }
    return result;
  }
}

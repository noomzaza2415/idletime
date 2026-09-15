import {
  formatDateString,
  getBreakRuleType,
  getShiftDateString,
  getShiftWindow,
  MIN_NOTIFY_MINS,
} from './idle-rules.js';

/**
 * เฝ้าดู API ของ Idle Time แล้วยิงแจ้งเตือนเองเมื่อมีรายการใหม่เข้ามา
 *
 * ทำที่นี่แทนการให้ backend .NET เรียก /Notify เพราะไม่ต้องแก้ระบบหลักเลย
 * แลกกับการที่ต้องถามข้อมูลเป็นระยะ ซึ่งช้ากว่าการให้ backend บอกทันทีที่เกิดเหตุ
 * ไม่เกินหนึ่งรอบ poll
 *
 * ถ้าวันหลัง backend ทำ webhook ได้ ให้เลิกใช้ watcher นี้แล้วเรียก /Notify ตรง ๆ จะทันกว่า
 */
export class IdleTimeWatcher {
  /**
   * @param {object} options
   * @param {string} options.apiBaseUrl ที่อยู่ API ของ Idle Time
   * @param {string} options.recordsPath path ของ endpoint ดึงรายการ
   * @param {number} options.intervalMs ความถี่ในการถาม
   * @param {(records: object[], target: {recordId: string, date: string}) => void} options.onNewRecords
   */
  constructor({ apiBaseUrl, recordsPath, intervalMs, onNewRecords }) {
    this.apiBaseUrl = apiBaseUrl;
    this.recordsPath = recordsPath;
    this.intervalMs = intervalMs;
    this.onNewRecords = onNewRecords;

    /** id ที่เคยเห็นแล้วในกะปัจจุบัน — null คือยังไม่เคยดึงสำเร็จเลย */
    this.seenIds = null;
    /** กะที่กำลังเฝ้าอยู่ ใช้ล้างรายการเมื่อขึ้นกะใหม่ */
    this.shiftDate = null;
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    // ดึงรอบแรกทันทีเพื่อตั้งฐานเปรียบเทียบ จะได้ไม่ต้องรอครบหนึ่งรอบก่อนเริ่มทำงานจริง
    void this.#tick();
    this.timer = setInterval(() => void this.#tick(), this.intervalMs);
    console.log(`เริ่มเฝ้าดูรายการใหม่ทุก ${this.intervalMs / 1000} วินาที ที่ ${this.apiBaseUrl}`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async #tick() {
    const shiftDate = getShiftDateString();

    // ขึ้นกะใหม่ให้ล้างฐานเปรียบเทียบ ไม่งั้นรายการของกะใหม่จะถูกมองว่าเคยเห็นแล้ว
    if (shiftDate !== this.shiftDate) {
      this.shiftDate = shiftDate;
      this.seenIds = null;
      console.log(`เปลี่ยนเป็นกะวันที่ ${shiftDate}`);
    }

    let records;
    try {
      records = await this.#fetchShift(shiftDate);
    } catch (err) {
      // API ล่มชั่วคราวไม่ต้องทำอะไร รอบหน้าค่อยลองใหม่
      console.error('ดึงรายการไม่สำเร็จ:', err.message);
      return;
    }

    // รอบแรกเก็บเป็นฐานเปรียบเทียบเฉย ๆ ไม่งั้นจะแจ้งเตือนทุกรายการที่มีอยู่แล้วตอนบริการเพิ่งเริ่ม
    if (this.seenIds === null) {
      this.seenIds = new Set(records.map((r) => r.id));
      console.log(`ตั้งฐานเปรียบเทียบ: ${this.seenIds.size} รายการในกะ ${shiftDate}`);
      return;
    }

    const fresh = records.filter((r) => !this.seenIds.has(r.id));
    if (fresh.length === 0) return;

    for (const r of fresh) this.seenIds.add(r.id);

    console.log(`พบรายการใหม่ ${fresh.length} รายการ`);

    // ส่งทั้งรายการไป ไม่ใช่แค่จำนวน ผู้เรียกจะได้แต่งข้อความบอกไลน์และเวลาได้เอง
    // หน้าที่แต่งข้อความอยู่ฝั่ง server.js เพื่อให้ watcher ทำแค่เรื่องตรวจจับอย่างเดียว
    this.onNewRecords(fresh, { recordId: String(fresh[0].id), date: shiftDate });
  }

  /**
   * ดึงรายการของกะที่ระบุ แล้วคัดเฉพาะรายการที่ต้องให้พนักงานกรอกสาเหตุจริง
   * เงื่อนไขเดียวกับที่แอปใช้ ไม่งั้นจะเตือนรายการที่แอปไม่แสดง
   */
  async #fetchShift(shiftDate) {
    const { start, end } = getShiftWindow(shiftDate);
    const qs = new URLSearchParams({
      dateFrom: formatDateString(start),
      dateTo: formatDateString(end),
      cdEquip: 'ALL',
    });

    const res = await fetch(`${this.apiBaseUrl}${this.recordsPath}?${qs}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`API ตอบ HTTP ${res.status}`);

    const body = await res.json();
    const raw = Array.isArray(body) ? body : (body?.result ?? []);

    return raw.filter((item) => {
      const at = new Date(item.dateTime);
      if (at < start || at > end) return false;

      // หยุดสั้นเกินกว่าจะมีสาเหตุให้กรอก แอปก็ไม่แสดงรายการพวกนี้เหมือนกัน
      if ((item.totaltimeoffMins ?? 0) <= MIN_NOTIFY_MINS) return false;

      // ช่วงพักตามแผนไม่ต้องกรอกสาเหตุ จึงไม่ต้องเตือน
      if (getBreakRuleType(item.timestartOff, item.totaltimeoffMins ?? 0) === 'HIDDEN') return false;

      // กรอกสาเหตุไปแล้วก็ไม่ต้องเตือน
      return !item.idletimeIss;
    });
  }
}

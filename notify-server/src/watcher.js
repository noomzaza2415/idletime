import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

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
   * @param {string} options.stateFile ไฟล์เก็บรายการที่เคยเห็นแล้ว ให้อยู่รอดข้ามการ restart
   * @param {(records: object[], target: {recordId: string, date: string}) => void} options.onNewRecords
   */
  constructor({ apiBaseUrl, recordsPath, intervalMs, stateFile, onNewRecords }) {
    this.apiBaseUrl = apiBaseUrl;
    this.recordsPath = recordsPath;
    this.intervalMs = intervalMs;
    this.stateFile = stateFile;
    this.onNewRecords = onNewRecords;

    /** id ที่เคยเห็นแล้วในกะปัจจุบัน — null คือยังไม่เคยดึงสำเร็จเลยตั้งแต่ติดตั้ง */
    this.seenIds = null;
    /** กะที่กำลังเฝ้าอยู่ ใช้ล้างรายการเมื่อขึ้นกะใหม่ */
    this.shiftDate = null;
    this.timer = null;

    /** เวลาที่ดึงสำเร็จครั้งล่าสุด ให้ /health ใช้ตัดสินว่า watcher ยังทำงานอยู่จริงไหม */
    this.lastOkAt = null;
    this.lastError = null;
    this.startedAt = null;

    this.#loadState();
  }

  start() {
    if (this.timer) return;
    this.startedAt = new Date();
    // ดึงรอบแรกทันทีเพื่อตั้งฐานเปรียบเทียบ จะได้ไม่ต้องรอครบหนึ่งรอบก่อนเริ่มทำงานจริง
    void this.#tick();
    this.timer = setInterval(() => void this.#tick(), this.intervalMs);
    console.log(`เริ่มเฝ้าดูรายการใหม่ทุก ${this.intervalMs / 1000} วินาที ที่ ${this.apiBaseUrl}`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * สถานะสำหรับ /health
   *
   * ถือว่าไม่ปกติเมื่อไม่ได้ดึงสำเร็จนานเกิน staleAfterMs เพราะลีดเดอร์จะเข้าใจว่า
   * ไม่มีแจ้งเตือนคือไลน์ไม่ได้หยุด ระบบที่ตายเงียบจึงอันตรายกว่าระบบที่ล่มให้เห็น
   * ช่วงเพิ่งเริ่มบริการยังไม่นับ เพื่อไม่ให้ healthcheck ฟ้องตั้งแต่วินาทีแรก
   */
  status(staleAfterMs) {
    const now = Date.now();
    const reference = this.lastOkAt ?? this.startedAt;
    const healthy = reference !== null && now - reference.getTime() <= staleAfterMs;
    return {
      healthy,
      lastOkAt: this.lastOkAt?.toISOString() ?? null,
      lastError: this.lastError,
      shiftDate: this.shiftDate,
      seen: this.seenIds?.size ?? 0,
    };
  }

  async #tick() {
    const shiftDate = getShiftDateString();

    if (shiftDate !== this.shiftDate) {
      // เคยทำงานมาก่อนแล้ว = ขึ้นกะใหม่จริง ให้เริ่มจากชุดว่าง ทุกรายการของกะใหม่จึงถูกแจ้ง
      // แม้บริการจะดับคร่อมช่วงเปลี่ยนกะ ส่วนครั้งแรกสุดที่ไม่เคยมีสถานะเลย
      // ค่อยตั้งฐานเปรียบเทียบ ไม่งั้นจะยิงแจ้งเตือนรายการเก่าทั้งกะตอนติดตั้ง
      this.seenIds = this.shiftDate === null ? null : new Set();
      this.shiftDate = shiftDate;
      console.log(`เปลี่ยนเป็นกะวันที่ ${shiftDate}`);
    }

    let records;
    try {
      records = await this.#fetchShift(shiftDate);
      this.lastOkAt = new Date();
      this.lastError = null;
    } catch (err) {
      // API ล่มชั่วคราวไม่ต้องทำอะไร รอบหน้าค่อยลองใหม่ แต่เก็บไว้ให้ /health เห็น
      this.lastError = err.message;
      console.error('ดึงรายการไม่สำเร็จ:', err.message);
      return;
    }

    if (this.seenIds === null) {
      this.seenIds = new Set(records.map((r) => r.id));
      this.#saveState();
      console.log(`ตั้งฐานเปรียบเทียบ: ${this.seenIds.size} รายการในกะ ${shiftDate}`);
      return;
    }

    const fresh = records.filter((r) => !this.seenIds.has(r.id));
    if (fresh.length === 0) return;

    for (const r of fresh) this.seenIds.add(r.id);
    // บันทึกก่อนยิง ถ้า process ตายระหว่างยิง รอบหน้าจะไม่เด้งซ้ำ
    // ยอมเสียแจ้งเตือนหนึ่งรอบดีกว่าเด้งซ้ำทุกครั้งที่ container restart วนอยู่
    this.#saveState();

    console.log(`พบรายการใหม่ ${fresh.length} รายการ`);

    // ส่งทั้งรายการไป ไม่ใช่แค่จำนวน ผู้เรียกจะได้แต่งข้อความบอกไลน์และเวลาได้เอง
    // หน้าที่แต่งข้อความอยู่ฝั่ง server.js เพื่อให้ watcher ทำแค่เรื่องตรวจจับอย่างเดียว
    this.onNewRecords(fresh, { recordId: String(fresh[0].id), date: shiftDate });
  }

  /**
   * โหลดสถานะที่บันทึกไว้ เพื่อให้ restart กลางกะแล้วยังรู้ว่าเคยแจ้งอะไรไปแล้ว
   * รายการที่เข้ามาช่วงที่บริการดับจึงถูกแจ้งเมื่อกลับมา ไม่หายไปเงียบ ๆ
   */
  #loadState() {
    if (!this.stateFile) return;
    try {
      const saved = JSON.parse(readFileSync(this.stateFile, 'utf8'));
      if (typeof saved.shiftDate === 'string' && Array.isArray(saved.seenIds)) {
        this.shiftDate = saved.shiftDate;
        this.seenIds = new Set(saved.seenIds);
        console.log(`โหลดสถานะเดิม: ${this.seenIds.size} รายการของกะ ${this.shiftDate}`);
      }
    } catch (err) {
      // ไม่มีไฟล์คือเพิ่งติดตั้งครั้งแรก ส่วนไฟล์พังให้เริ่มใหม่ ดีกว่าบริการไม่ยอมขึ้น
      if (err.code !== 'ENOENT') console.error('อ่านสถานะ watcher ไม่ได้ เริ่มใหม่:', err.message);
    }
  }

  #saveState() {
    if (!this.stateFile) return;
    try {
      mkdirSync(dirname(this.stateFile), { recursive: true });
      const tmp = `${this.stateFile}.tmp`;
      writeFileSync(tmp, JSON.stringify({ shiftDate: this.shiftDate, seenIds: [...this.seenIds] }));
      // เขียนไฟล์ชั่วคราวแล้ว rename กันไฟล์พังถ้าไฟดับกลางคัน
      renameSync(tmp, this.stateFile);
    } catch (err) {
      // เขียนไม่ได้ไม่ควรหยุดการแจ้งเตือน แค่เสียความสามารถกู้หลัง restart
      console.error('บันทึกสถานะ watcher ไม่สำเร็จ:', err.message);
    }
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

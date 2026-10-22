import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * ที่เก็บ FCM token ของเครื่องที่ลงทะเบียนไว้
 *
 * ใช้ไฟล์ JSON แทนฐานข้อมูลโดยตั้งใจ เพราะบริการนี้เก็บแค่รายการ token
 * ซึ่งมีจำนวนเท่ากับจำนวนเครื่องในโรงงาน (หลักสิบ) การลง PostgreSQL หรือ MySQL
 * เพิ่มบน server เพียงเพื่อข้อมูลเท่านี้ทำให้ deploy ยากขึ้นโดยไม่ได้อะไรกลับมา
 *
 * เขียนแบบ atomic (เขียนไฟล์ชั่วคราวแล้ว rename) กันไฟล์พังถ้าไฟดับกลางคัน
 */
export class TokenStore {
  /** @param {string} filePath ตำแหน่งไฟล์ข้อมูล */
  constructor(filePath) {
    this.filePath = filePath;
    /** @type {Map<string, {token: string, platform: string, userName: string|null, createdAt: string, lastSeenAt: string, active: boolean}>} */
    this.tokens = new Map();
    this.#load();
  }

  #load() {
    try {
      const raw = readFileSync(this.filePath, 'utf8');
      for (const entry of JSON.parse(raw)) this.tokens.set(entry.token, entry);
    } catch (err) {
      // ไฟล์ยังไม่มีตอนรันครั้งแรกถือเป็นเรื่องปกติ อย่างอื่นค่อยโวย
      if (err.code !== 'ENOENT') throw err;
    }
  }

  #save() {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify([...this.tokens.values()], null, 2));
    renameSync(tmp, this.filePath);
  }

  /**
   * บันทึกเครื่องหนึ่งเครื่อง เรียกซ้ำได้ เครื่องเดิมจะอัปเดตแถวเดิม
   * @returns {'created' | 'updated'}
   */
  register(token, platform, userName) {
    const now = new Date().toISOString();
    const existing = this.tokens.get(token);

    if (existing) {
      existing.platform = platform;
      existing.userName = userName ?? null;
      existing.lastSeenAt = now;
      // เครื่องที่เคยถูกปิดไว้ กลับมาลงทะเบียนใหม่ถือว่าใช้ได้อีกครั้ง
      existing.active = true;
    } else {
      this.tokens.set(token, {
        token,
        platform,
        userName: userName ?? null,
        createdAt: now,
        lastSeenAt: now,
        active: true,
      });
    }

    this.#save();
    return existing ? 'updated' : 'created';
  }

  /**
   * เครื่องทั้งหมดที่ยังส่งได้ พร้อม platform เพราะ iPhone ต้องส่งผ่าน APNs ไม่ใช่ FCM
   * @returns {{token: string, platform: string}[]}
   */
  activeDevices() {
    return [...this.tokens.values()]
      .filter((t) => t.active)
      .map((t) => ({ token: t.token, platform: t.platform }));
  }

  /**
   * ปิดเครื่องที่ FCM บอกว่าใช้ไม่ได้แล้ว (ถอนแอป/ปิดแจ้งเตือน/token หมดอายุ)
   * ไม่ลบทิ้งเพื่อให้ยังตรวจย้อนหลังได้ว่าเครื่องไหนเคยลงทะเบียน
   */
  deactivate(tokens) {
    let changed = 0;
    for (const token of tokens) {
      const entry = this.tokens.get(token);
      if (entry?.active) {
        entry.active = false;
        changed += 1;
      }
    }
    if (changed > 0) this.#save();
    return changed;
  }

  stats() {
    const all = [...this.tokens.values()];
    return { total: all.length, active: all.filter((t) => t.active).length };
  }
}

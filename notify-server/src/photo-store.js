import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { getShiftDateString } from './idle-rules.js';

/** นามสกุลที่ยอมให้อัปโหลด แมปจาก mime type ที่มือถือส่งมา */
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

/** mime type สำหรับตอนส่งไฟล์กลับ กลับทางกับ EXT_BY_MIME */
const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

/**
 * รูปแบบชื่อไฟล์: 20260909_142530_1024_a1b2.jpg
 * คือ ปีเดือนวัน _ ชั่วโมงนาทีวินาที _ id ของรายการ _ ตัวสุ่มกันชนกัน
 *
 * ใช้ตรวจชื่อไฟล์ที่รับมาจาก client ทุกครั้งก่อนเอาไปต่อเป็น path
 * ถ้าไม่ตรวจ ชื่ออย่าง "../../.env" จะอ่านไฟล์นอกโฟลเดอร์ออกไปได้
 */
const FILE_NAME_PATTERN = /^(\d{8})_\d{6}_[A-Za-z0-9_-]{1,32}_[a-z0-9]{4}\.(jpg|png)$/;

/** id รายการมาจาก URL จึงต้องคุมให้เป็นอักขระที่ปลอดภัยก่อนใช้ตั้งชื่อไฟล์ */
const RECORD_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/**
 * จำกัดจำนวนรูปต่อรายการ ตามที่หน้างานกำหนดไว้ 2 รูป และกันคนกดรัวจนดิสก์เต็ม
 * ต้องตรงกับ MAX_PHOTOS ในหน้ากรอกสาเหตุของแอป
 */
export const MAX_PHOTOS_PER_RECORD = 2;

export function isValidRecordId(value) {
  return typeof value === 'string' && RECORD_ID_PATTERN.test(value);
}

export function isValidFileName(value) {
  return typeof value === 'string' && FILE_NAME_PATTERN.test(value);
}

/** "20260909_142530_1024_a1b2.jpg" -> ".jpg" */
function extOf(fileName) {
  return fileName.slice(fileName.lastIndexOf('.'));
}

/** เติมศูนย์ข้างหน้าให้ครบสองหลัก ใช้ประกอบชื่อไฟล์ */
function pad(value) {
  return String(value).padStart(2, '0');
}

/**
 * ที่เก็บรูปแนบของรายการ idle time
 *
 * ตัวไฟล์รูปอยู่บนดิสก์ แยกโฟลเดอร์ตามเดือนเพื่อไม่ให้ไฟล์กองอยู่ที่เดียวเป็นแสนใบ
 * ส่วนข้อมูลว่ารูปไหนเป็นของรายการไหนเก็บเป็นไฟล์ JSON ไฟล์เดียว
 *
 * ที่ไม่ใช้ฐานข้อมูลด้วยเหตุผลเดียวกับ TokenStore คือข้อมูลมีแค่หลักพันแถวต่อปี
 * การเพิ่มฐานข้อมูลบน server เพียงเพื่อข้อมูลเท่านี้ทำให้ deploy ยากขึ้นโดยไม่ได้อะไรกลับมา
 *
 * ชื่อไฟล์เองก็บอกได้อยู่แล้วว่าเป็นของรายการไหนและถ่ายเมื่อไร ถ้าไฟล์ JSON หาย
 * ก็ยังไล่กู้จากชื่อไฟล์บนดิสก์ได้ ไม่ถึงกับข้อมูลตายสนิท
 */
export class PhotoStore {
  /**
   * @param {string} rootDir โฟลเดอร์แม่ที่เก็บรูป เช่น ./data/photos
   * @param {string} indexFile ไฟล์ JSON ที่บอกว่ารูปไหนของรายการไหน
   */
  constructor(rootDir, indexFile) {
    this.rootDir = rootDir;
    this.indexFile = indexFile;
    /** บันทึกการลบรูป อยู่ข้าง photos.json ให้สำรองไปพร้อมกัน */
    this.deletionLog = join(dirname(indexFile), 'photo-deletions.log');
    /** @type {Map<string, Array<{fileName: string, size: number, userName: string|null, createdAt: string}>>} */
    this.byRecord = new Map();
    this.#load();
  }

  #load() {
    try {
      const raw = readFileSync(this.indexFile, 'utf8');
      for (const [recordId, list] of Object.entries(JSON.parse(raw))) {
        this.byRecord.set(recordId, list);
      }
    } catch (err) {
      // ไฟล์ยังไม่มีตอนรันครั้งแรกถือเป็นเรื่องปกติ อย่างอื่นค่อยโวย
      if (err.code !== 'ENOENT') throw err;
    }
  }

  #save() {
    mkdirSync(dirname(this.indexFile), { recursive: true });
    const tmp = `${this.indexFile}.tmp`;
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.byRecord), null, 2));
    // เขียนไฟล์ชั่วคราวแล้ว rename กันไฟล์พังถ้าไฟดับกลางคัน
    renameSync(tmp, this.indexFile);
  }

  /**
   * โฟลเดอร์เดือนของรูปที่กำลังจะบันทึก
   *
   * ยึด "วันที่ของกะ" ไม่ใช่วันที่ตามนาฬิกา เพราะกะเริ่ม 08:00 และลากข้ามเที่ยงคืน
   * รูปที่ถ่ายตอนตีหนึ่งของวันที่ 1 กันยา เป็นงานของกะวันที่ 31 สิงหา
   * ถ้าแบ่งด้วยเวลานาฬิกา รูปจะไปอยู่คนละเดือนกับรายงานที่ฝั่งเว็บออกให้
   */
  static monthOf(now = new Date()) {
    return getShiftDateString(now).slice(0, 7);
  }

  /**
   * ตั้งชื่อไฟล์ตามเวลาที่ถ่ายจริง
   *
   * เวลาในชื่อเป็นเวลานาฬิกา ไม่ใช่เวลาของกะ คนที่เปิดดูไฟล์จะได้รู้ว่าถ่ายกี่โมงจริง ๆ
   * จึงมีบางกรณีที่ไฟล์ชื่อขึ้นต้นด้วยวันที่ 1 กันยา แต่อยู่ในโฟลเดอร์ 2026-08 ซึ่งถูกแล้ว
   */
  static buildFileName(recordId, mimeType, now = new Date()) {
    const stamp =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    // ถ่ายรัวสองใบในวินาทีเดียวกันชื่อจะซ้ำทันที ตัวสุ่มท้ายชื่อกันไว้
    const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
    return `${stamp}_${recordId}_${rand}${EXT_BY_MIME[mimeType]}`;
  }

  /**
   * path จริงบนดิสก์ของไฟล์หนึ่งใบ
   *
   * เดือนคำนวณจากชื่อไฟล์ได้เลยไม่ต้องพึ่ง index แต่ต้องอ่านเวลาในชื่อมาด้วย ไม่ใช่แค่วันที่
   * เพราะไฟล์ที่ถ่ายก่อน 08:00 ถูกเก็บไว้ในโฟลเดอร์เดือนของกะซึ่งอาจเป็นเดือนก่อนหน้า
   */
  pathOf(fileName) {
    const n = (from, to) => Number(fileName.slice(from, to));
    const taken = new Date(
      n(0, 4), n(4, 6) - 1, n(6, 8), n(9, 11), n(11, 13), n(13, 15)
    );
    return join(this.rootDir, PhotoStore.monthOf(taken), fileName);
  }

  /** รายการรูปของรายการหนึ่ง เรียงจากเก่าไปใหม่ */
  list(recordId) {
    return this.byRecord.get(recordId) ?? [];
  }

  /**
   * บันทึกรูปหนึ่งใบ
   * @returns {{fileName: string, size: number, createdAt: string}}
   */
  add(recordId, buffer, mimeType, userName, cdEquip = null, now = new Date()) {
    // รองรับ caller เดิมที่ส่ง `now` เป็นอาร์กิวเมนต์ตัวที่ห้า
    // เพื่อให้การเพิ่ม cdEquip ไม่ทำให้ test หรือ integration รุ่นเก่าตั้งเวลาผิด
    if (cdEquip instanceof Date) {
      now = cdEquip;
      cdEquip = null;
    }
    const fileName = PhotoStore.buildFileName(recordId, mimeType, now);
    const month = PhotoStore.monthOf(now);
    const dir = join(this.rootDir, month);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, fileName), buffer);

    const entry = {
      fileName,
      size: buffer.length,
      userName: userName ?? null,
      cdEquip: cdEquip ?? null,
      createdAt: now.toISOString(),
    };
    const list = this.byRecord.get(recordId) ?? [];
    list.push(entry);
    this.byRecord.set(recordId, list);
    this.#save();
    return entry;
  }

  /**
   * เอารูปหนึ่งใบออกจากรายการ
   *
   * ไม่ลบไฟล์ทิ้งจริง แต่ย้ายไปไว้ใน _trash และจดว่าใครลบ เพราะรูปคือหลักฐานว่าไลน์หยุดเพราะอะไร
   * เส้นลบไม่มีการยืนยันตัวตน และลีดเดอร์ทุกคนลบรูปของทุกไลน์ได้ ถ้าลบผิดต้องกู้คืนได้
   *
   * @param {string|null} userName ผู้ที่สั่งลบ ตามที่แอปส่งมา
   * @returns {boolean} false เมื่อไม่เจอรูปนั้นในรายการที่ระบุ
   */
  remove(recordId, fileName, userName = null, now = new Date()) {
    const list = this.byRecord.get(recordId);
    const index = list?.findIndex((p) => p.fileName === fileName) ?? -1;
    if (!list || index < 0) return false;

    const [entry] = list.splice(index, 1);
    if (list.length === 0) this.byRecord.delete(recordId);
    else this.byRecord.set(recordId, list);
    this.#save();

    const trashPath = this.trashPathOf(fileName);
    try {
      mkdirSync(dirname(trashPath), { recursive: true });
      renameSync(this.pathOf(fileName), trashPath);
    } catch (err) {
      // ไฟล์หายไปก่อนแล้วก็ถือว่าจบงาน ไม่ต้องโวย ส่วนกรณีอื่นยังจดลง log ไว้ให้ตามได้
      if (err.code !== 'ENOENT') console.error(`ย้ายรูป ${fileName} ไป _trash ไม่สำเร็จ:`, err.message);
    }

    try {
      mkdirSync(dirname(this.deletionLog), { recursive: true });
      appendFileSync(
        this.deletionLog,
        `${JSON.stringify({ deletedAt: now.toISOString(), deletedBy: userName, recordId, ...entry })}\n`
      );
    } catch (err) {
      console.error('จดบันทึกการลบรูปไม่สำเร็จ:', err.message);
    }
    return true;
  }

  /** ที่เก็บรูปที่ถูกลบ แยกเดือนเหมือนรูปปกติ กู้คืนแค่ย้ายกลับโฟลเดอร์เดือนเดิม */
  trashPathOf(fileName) {
    const livePath = this.pathOf(fileName);
    return join(this.rootDir, '_trash', basename(dirname(livePath)), fileName);
  }

  /** ไฟล์ยังอยู่บนดิสก์จริงไหม เผื่อ index กับดิสก์ไม่ตรงกัน */
  exists(fileName) {
    const path = this.pathOf(fileName);
    return existsSync(path) && statSync(path).isFile();
  }

  /** mime type สำหรับตอบกลับ อ่านจากนามสกุลไฟล์ */
  static mimeOf(fileName) {
    return MIME_BY_EXT[extOf(fileName)] ?? 'application/octet-stream';
  }

  stats() {
    let files = 0;
    let bytes = 0;
    for (const list of this.byRecord.values()) {
      files += list.length;
      for (const p of list) bytes += p.size;
    }
    return { records: this.byRecord.size, files, bytes };
  }
}

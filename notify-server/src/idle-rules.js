/**
 * กติกาช่วงพักของไลน์ผลิต — ก๊อปมาจาก src/api/idle-rules.ts ของแอปแบบตรงตัว
 *
 * ต้องเหมือนกันเป๊ะ ไม่งั้นจะแจ้งเตือนรายการที่แอปซ่อนไว้
 * พนักงานจะเปิดแอปตามแจ้งเตือนแล้วหาไม่เจอว่ารายการไหน
 *
 * ถ้าแก้กติกาฝั่งแอปเมื่อไหร่ ต้องแก้ไฟล์นี้ให้ตรงกันด้วย
 */

/** HIDDEN = พักตามแผน ไม่ต้องกรอกสาเหตุ · SHOW_BUTTON = น่าจะพัก แต่ให้พนักงานยืนยันเอง */
const BREAK_RULES = [
  // กลุ่ม HIDDEN: หยุดตั้งแต่ minDuration ขึ้นไปในช่วงนี้ = ช่วงพักตามแผน ซ่อนทิ้ง
  { start: 9 * 60 + 58, end: 10 * 60 + 12, minDuration: 9, type: 'HIDDEN' }, // เบรกเช้า
  { start: 11 * 60 + 58, end: 13 * 60 + 2, minDuration: 55, type: 'HIDDEN' }, // พักเที่ยง
  { start: 14 * 60 + 58, end: 15 * 60 + 12, minDuration: 8, type: 'HIDDEN' }, // เบรกบ่าย
  { start: 16 * 60 + 58, end: 17 * 60 + 32, minDuration: 25, type: 'HIDDEN' }, // ต่อกะ
  { start: 21 * 60 + 58, end: 22 * 60 + 12, minDuration: 9, type: 'HIDDEN' }, // เบรกดึก
  // สองแถวนี้คือช่วงเดียวกันที่ถูกผ่าครึ่ง เพราะเทียบเป็นนาทีนับจากเที่ยงคืน ข้ามวันไม่ได้
  { start: 22 * 60 + 58, end: 24 * 60 + 2, minDuration: 50, type: 'HIDDEN' }, // พักกะดึก ก่อนเที่ยงคืน
  { start: 0, end: 2, minDuration: 50, type: 'HIDDEN' }, // พักกะดึก หลังเที่ยงคืน
  { start: 10 * 60 + 58, end: 12 * 60 + 2, minDuration: 50, type: 'SHOW_BUTTON' },
  { start: 11 * 60 + 28, end: 12 * 60 + 32, minDuration: 50, type: 'SHOW_BUTTON' },
  { start: 19 * 60 + 46, end: 20 * 60 + 12, minDuration: 9, type: 'SHOW_BUTTON' },
  { start: 19 * 60 + 48, end: 20 * 60 + 2, minDuration: 9, type: 'SHOW_BUTTON' },
  { start: 19 * 60 + 58, end: 20 * 60 + 12, minDuration: 9, type: 'SHOW_BUTTON' },
  { start: 16 * 60 + 28, end: 17 * 60 + 2, minDuration: 26, type: 'SHOW_BUTTON' },
  { start: 16 * 60 + 59, end: 17 * 60 + 32, minDuration: 26, type: 'SHOW_BUTTON' },
  { start: 18 * 60 + 28, end: 20 * 60 + 32, minDuration: 60, type: 'SHOW_BUTTON' },
  { start: 11 * 60 + 58, end: 12 * 60 + 32, minDuration: 25, type: 'SHOW_BUTTON' },
  { start: 8 * 60, end: 23 * 60 + 59, minDuration: 100, type: 'SHOW_BUTTON' },
];

/**
 * ระยะเวลาหยุดขั้นต่ำที่ถือว่าน่าสนใจพอจะแจ้งเตือน
 *
 * ต้องตรงกับ MIN_VISIBLE_MINS ในแอป (src/api/idle-rules.ts) เสมอ ไม่งั้นจะเตือน
 * รายการที่พนักงานเปิดแอปมาแล้วหาไม่เจอ เพราะแอปกรองทิ้งไปแล้ว
 *
 * เทียบแบบ "ไม่เกิน" คือ 2.00 นาทีพอดีก็ไม่เตือน ต้องมากกว่านี้เท่านั้น
 */
export const MIN_NOTIFY_MINS = 2;

export function getBreakRuleType(isoDateTime, durationMins) {
  if (!isoDateTime || !durationMins) return null;

  const date = new Date(isoDateTime);
  const startMinutes = date.getHours() * 60 + date.getMinutes();

  for (const rule of BREAK_RULES) {
    if (startMinutes >= rule.start && startMinutes <= rule.end && durationMins >= rule.minDuration) {
      return rule.type;
    }
  }
  return null;
}

/**
 * วันที่ของกะปัจจุบัน — กะเริ่ม 08:00
 * ก่อนแปดโมงยังถือเป็นกะของเมื่อวาน ไม่งั้นกะดึกจะถูกตัดครึ่งตอนเที่ยงคืน
 */
export function getShiftDateString(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < 8) d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ขอบเขตของกะ: 08:00 ของวันที่ระบุ ถึง 07:59:59.999 ของวันถัดไป */
export function getShiftWindow(dateString) {
  const start = new Date(`${dateString}T08:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(7, 59, 59, 999);
  return { start, end };
}

/**
 * รูปแบบวันที่ที่ API ต้องการ: YYYY-MM-DD เท่านั้น ห้ามพ่วงเวลา
 *
 * ถ้าส่งเวลาไปด้วย เช่น "2026-09-07 08:00:00" API จะคืนรายการว่างเปล่า
 * ทดสอบยืนยันแล้วกับวันที่มีข้อมูลจริง 91 รายการ: ส่งวันที่ล้วนได้ครบ 91
 * ส่งพ่วงเวลา 08:00:00 ได้ 0 ทั้งที่เป็นช่วงเดียวกัน
 *
 * ต้องตรงกับ formatDateString ของฝั่งแอปที่ src/api/idle-rules.ts ซึ่งส่งวันที่ล้วนอยู่แล้ว
 * การคัดกรองให้อยู่ในกรอบกะทำทีหลังฝั่งเราเอง ไม่ได้พึ่งเวลาใน query
 */
export function formatDateString(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

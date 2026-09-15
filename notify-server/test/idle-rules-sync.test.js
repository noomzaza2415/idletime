// กติกาเวลากะอิงเวลาโรงงาน ต้องตั้งก่อนมีการสร้าง Date ใด ๆ
process.env.TZ = 'Asia/Bangkok';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import * as server from '../src/idle-rules.js';
import { MAX_PHOTOS_PER_RECORD } from '../src/photo-store.js';

/**
 * กติกาช่วงพักมีสองสำเนา คือของแอป (src/api/idle-rules.ts) กับของ notify-server
 * ถ้าไม่ตรงกัน server จะแจ้งเตือนรายการที่แอปซ่อนไว้ ลีดเดอร์เปิดแอปมาแล้วหาไม่เจอ
 * test นี้ import ไฟล์ .ts ของแอปมาเทียบตรง ๆ (Node รุ่นใหม่ตัด type ออกให้เอง)
 */
const app = await import('../../src/api/idle-rules.ts');

/** "2026-09-15T10:05:00" — รูปแบบเดียวกับที่ API ส่งมา ไม่มี timezone ต่อท้าย */
function isoAt(minuteOfDay) {
  const h = String(Math.floor(minuteOfDay / 60)).padStart(2, '0');
  const m = String(minuteOfDay % 60).padStart(2, '0');
  return `2026-09-15T${h}:${m}:00`;
}

test('getBreakRuleType ของแอปกับ server ให้ผลตรงกันทุกนาทีของวัน', () => {
  for (let minute = 0; minute < 24 * 60; minute++) {
    for (let duration = 0; duration <= 120; duration += 0.5) {
      const iso = isoAt(minute);
      assert.equal(
        server.getBreakRuleType(iso, duration),
        app.getBreakRuleType(iso, duration),
        `ไม่ตรงกันที่ ${iso} หยุด ${duration} นาที`
      );
    }
  }
});

test('เกณฑ์ขั้นต่ำที่แอปแสดง ตรงกับเกณฑ์ที่ server แจ้งเตือน', () => {
  assert.equal(server.MIN_NOTIFY_MINS, app.MIN_VISIBLE_MINS);
});

test('วันที่ของกะและช่วงเวลากะตรงกัน รวมช่วงก่อน 08:00 ที่ยังเป็นกะเมื่อวาน', () => {
  const samples = ['2026-09-15T07:59:59', '2026-09-15T08:00:00', '2026-09-15T23:30:00', '2026-10-01T03:00:00'];
  for (const s of samples) {
    const now = new Date(s);
    assert.equal(server.getShiftDateString(now), app.getShiftDateString(now), s);
  }
  assert.equal(app.getShiftDateString(new Date('2026-10-01T03:00:00')), '2026-09-30');

  const a = app.getShiftWindow('2026-09-15');
  const b = server.getShiftWindow('2026-09-15');
  assert.equal(a.start.getTime(), b.start.getTime());
  assert.equal(a.end.getTime(), b.end.getTime());
});

/**
 * ตัวอย่างรูปธรรมตามที่เจ้าของโปรเจกต์ยืนยันไว้ ใช้กันการสลับทิศเงื่อนไขโดยไม่ตั้งใจ
 * กติกาคือยิ่งหยุดนานในช่วงพักยิ่งถูกนับเป็นการพัก (durationMins >= minDuration)
 */
test('ตัวอย่างกติกาช่วงพัก', () => {
  // เบรกเช้า 09:58-10:12 ขั้นต่ำ 9 นาที
  assert.equal(app.getBreakRuleType(isoAt(10 * 60), 12), 'HIDDEN');
  assert.equal(app.getBreakRuleType(isoAt(10 * 60), 5), null);
  // พักเที่ยงขั้นต่ำ 55 นาที
  assert.equal(app.getBreakRuleType(isoAt(12 * 60), 60), 'HIDDEN');
  // นอกช่วงพักและสั้นกว่า 100 นาที ไม่ใช่การพัก
  assert.equal(app.getBreakRuleType(isoAt(9 * 60), 30), null);
  // หยุดตั้งแต่ 100 นาทีระหว่าง 08:00-23:59 ให้พนักงานเลือกเอง
  assert.equal(app.getBreakRuleType(isoAt(9 * 60), 100), 'SHOW_BUTTON');
});

test('เพดานรูปต่อรายการของแอปตรงกับ server', () => {
  const screen = readFileSync(new URL('../../src/app/(app)/record/[id].tsx', import.meta.url), 'utf8');
  const match = screen.match(/const MAX_PHOTOS = (\d+);/);
  assert.ok(match, 'หา MAX_PHOTOS ในหน้ากรอกสาเหตุไม่เจอ');
  assert.equal(Number(match[1]), MAX_PHOTOS_PER_RECORD);
});

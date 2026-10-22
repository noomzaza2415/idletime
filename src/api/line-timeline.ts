import { getBreakRuleType, getShiftWindow } from '@/api/idle-rules';
import type { ApiIdleTimeRecord } from '@/types';

/**
 * แถบสถานะไลน์ตลอดกะ: ช่วงเดินงาน ช่วงหยุด และช่วงพัก
 *
 * พอร์ตจาก StatusTimelineBar ของหน้าเว็บ ต้องคำนวณแบบเดียวกันทุกขั้น
 * ไม่งั้นลีดเดอร์เปิดมือถือกับหน้าจอเว็บพร้อมกันแล้วเห็นนาทีหยุดไม่ตรงกัน
 *
 * ต่างจากหน้ารายการตรงที่ไม่ตัดรายการที่หยุดไม่เกิน 1 นาที เพราะแถบนี้ต้องเห็นทุกครั้งที่ไลน์หยุดจริง
 */

export type SegmentKind = 'stop' | 'break';

/** ปุ่มเลือกช่วงของเว็บ: 8 ชม. = 08:00-16:00, 12 ชม. = 08:00-20:00, ทั้งวัน = ถึง 08:00 วันถัดไป */
export type RangeHours = 8 | 12 | 24;

/** รายการหยุดหนึ่งครั้งตามที่ API ส่งมา ยังไม่ตัดตามช่วงที่แสดง */
export interface TimelineEvent {
  id: number;
  start: number;
  /** null = ยังไม่มีเวลาเดินต่อ ถือว่าหยุดถึงตอนนี้ แบบเดียวกับเว็บ */
  end: number | null;
  status: string | null;
}

export interface LineTimeline {
  /** 08:00 ของวันกะ */
  shiftStart: number;
  shiftEnd: number;
  /** เรียงตามเวลาเริ่ม */
  events: TimelineEvent[];
}

/** ช่วงหยุดที่ตัดให้อยู่ในช่วงที่แสดงแล้ว */
export interface TimelineSegment {
  id: number;
  start: number;
  end: number;
  kind: SegmentKind;
  status: string | null;
  /** นาทีที่มองเห็นในช่วงที่แสดง ไม่ใช่ totaltimeoffMins ของระบบ (เว็บใช้แบบนี้) */
  mins: number;
}

export interface TimelineView {
  start: number;
  /** เวลาปัจจุบันหรือสุดช่วงที่เลือก แล้วแต่อันไหนมาก่อน */
  end: number;
  segments: TimelineSegment[];
  stopMins: number;
  breakMins: number;
  stopCount: number;
  breakCount: number;
  /** นาทีที่ไม่มีช่วงหยุดหรือพักคลุม นับช่วงซ้อนกันครั้งเดียว */
  runningMins: number;
  /** สัดส่วนเวลาเดินงาน 0-1 */
  runningRatio: number;
}

/**
 * @param raw ข้อมูลดิบของไลน์เดียว
 * @param shiftDate วันที่ของกะ รูปแบบ YYYY-MM-DD
 */
export function buildLineTimeline(raw: ApiIdleTimeRecord[], shiftDate: string): LineTimeline {
  const { start, end } = getShiftWindow(shiftDate);

  const events: TimelineEvent[] = [];
  for (const item of raw) {
    // เว็บกรองด้วย dateTime ของรายการก่อน ไม่ใช่ด้วยเวลาที่หยุด
    const recordTime = new Date(item.dateTime);
    if (recordTime < start || recordTime > end) continue;
    if (!item.timestartOff) continue;

    const evStart = new Date(item.timestartOff).getTime();
    const evEnd = item.timestartOn ? new Date(item.timestartOn).getTime() : null;
    if (Number.isNaN(evStart) || (evEnd !== null && Number.isNaN(evEnd))) continue;

    events.push({ id: item.id, start: evStart, end: evEnd, status: item.status });
  }

  events.sort((a, b) => a.start - b.start);
  return { shiftStart: start.getTime(), shiftEnd: end.getTime(), events };
}

/** เวลาสุดช่วงของปุ่มแต่ละปุ่ม ตรงกับ localShiftEnd ของเว็บ */
export function rangeLimit(shiftStart: number, range: RangeHours) {
  const d = new Date(shiftStart);
  if (range === 8) {
    d.setHours(16, 0, 0, 0);
  } else if (range === 12) {
    d.setHours(20, 0, 0, 0);
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
  }
  return d.getTime();
}

/**
 * ตรงกับ isInsideBreakRule + isBreakStatus ของเว็บ
 *
 * เว็บนับเป็นพักเมื่อตรงกติกาข้อไหนก็ได้ รวมถึงข้อที่หน้ารายการให้พนักงานเลือกเอง (SHOW_BUTTON)
 * getBreakRuleType คืนค่าเมื่อมีกติกาข้อใดตรง จึงใช้ "ไม่เป็น null" แทนได้
 * ส่วนการเทียบช่วงข้ามเที่ยงคืนของเว็บได้ผลเท่ากัน เพราะกติกามีแถว 00:00-00:02 แยกไว้อยู่แล้ว
 */
function isBreak(startMs: number, mins: number, status: string | null) {
  if (getBreakRuleType(new Date(startMs).toISOString(), mins) !== null) return true;
  return (status ?? '').toLowerCase().includes('break');
}

/** คำนวณสิ่งที่แถบต้องแสดงในช่วงที่เลือก ณ เวลาที่ระบุ */
export function viewTimeline(timeline: LineTimeline, now: number, range: RangeHours): TimelineView {
  const start = timeline.shiftStart;
  const end = Math.max(start, Math.min(now, rangeLimit(start, range)));

  let stopMins = 0;
  let breakMins = 0;
  let stopCount = 0;
  let breakCount = 0;
  const segments: TimelineSegment[] = [];

  for (const ev of timeline.events) {
    const evEnd = ev.end ?? now;
    if (evEnd <= start || ev.start >= end) continue;

    const clampedStart = Math.max(ev.start, start);
    const clampedEnd = Math.min(evEnd, end);
    const mins = (clampedEnd - clampedStart) / 60_000;
    if (mins <= 0) continue;

    const kind: SegmentKind = isBreak(clampedStart, mins, ev.status) ? 'break' : 'stop';
    if (kind === 'break') {
      breakMins += mins;
      breakCount += 1;
    } else {
      stopMins += mins;
      stopCount += 1;
    }
    segments.push({ id: ev.id, start: clampedStart, end: clampedEnd, kind, status: ev.status, mins });
  }

  // เวลาเดินงานคิดจากช่วงที่ไม่ถูกคลุม ไม่ใช่เอายอดรวมไปลบ
  // เพราะรายการจริงซ้อนกันได้ ถ้าลบตรง ๆ จะได้เวลาเดินงานน้อยกว่าความจริง
  let coveredMs = 0;
  let cursorStart = 0;
  let cursorEnd = -Infinity;
  for (const seg of segments) {
    if (seg.start > cursorEnd) {
      if (cursorEnd > cursorStart) coveredMs += cursorEnd - cursorStart;
      cursorStart = seg.start;
      cursorEnd = seg.end;
    } else {
      cursorEnd = Math.max(cursorEnd, seg.end);
    }
  }
  if (cursorEnd > cursorStart) coveredMs += cursorEnd - cursorStart;

  const elapsedMs = end - start;
  const runningMs = Math.max(0, elapsedMs - coveredMs);

  return {
    start,
    end,
    segments,
    stopMins,
    breakMins,
    stopCount,
    breakCount,
    runningMins: runningMs / 60_000,
    runningRatio: elapsedMs > 0 ? runningMs / elapsedMs : 0,
  };
}

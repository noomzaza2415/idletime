/**
 * กติกาทางธุรกิจของ Idle Time — พอร์ตมาจากเว็บ (page.tsx / contacts-table.tsx)
 * ต้องใช้ชุดเดียวกันเป๊ะ ไม่งั้นมือถือกับเว็บจะเห็นรายการไม่ตรงกัน
 */

type BreakRuleType = 'HIDDEN' | 'SHOW_BUTTON';

interface BreakRule {
  /** นาทีที่เริ่มนับจากเที่ยงคืน */
  start: number;
  /** นาทีที่สิ้นสุดนับจากเที่ยงคืน */
  end: number;
  /** ระยะเวลาหยุดขั้นต่ำ (นาที) ที่เข้าเงื่อนไข */
  minDuration: number;
  type: BreakRuleType;
}

const BREAK_RULES: BreakRule[] = [
  { start: 9 * 60 + 58, end: 10 * 60 + 12, minDuration: 9, type: 'HIDDEN' },
  { start: 11 * 60 + 58, end: 13 * 60 + 2, minDuration: 55, type: 'HIDDEN' },
  { start: 14 * 60 + 58, end: 15 * 60 + 12, minDuration: 8, type: 'HIDDEN' },
  { start: 16 * 60 + 58, end: 17 * 60 + 32, minDuration: 25, type: 'HIDDEN' },
  { start: 21 * 60 + 58, end: 22 * 60 + 12, minDuration: 9, type: 'HIDDEN' },
  { start: 22 * 60 + 58, end: 24 * 60 + 2, minDuration: 50, type: 'HIDDEN' },
  { start: 0, end: 2, minDuration: 50, type: 'HIDDEN' },
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
 * HIDDEN = ช่วงพักตามแผน ไม่ต้องแสดงให้กรอกสาเหตุ
 * SHOW_BUTTON = น่าจะเป็นช่วงพัก แต่ให้พนักงานยืนยันเอง
 */
export function getBreakRuleType(
  isoDateTime: string | null,
  durationMins: number | null
): BreakRuleType | null {
  if (!isoDateTime || !durationMins) return null;
  const date = new Date(isoDateTime);
  const startMinutes = date.getHours() * 60 + date.getMinutes();
  for (const rule of BREAK_RULES) {
    if (
      startMinutes >= rule.start &&
      startMinutes <= rule.end &&
      durationMins >= rule.minDuration
    ) {
      return rule.type;
    }
  }
  return null;
}

/** วันที่ของกะปัจจุบัน — กะเริ่ม 08:00 ถ้ายังไม่ถึง 8 โมงให้ถือเป็นกะของเมื่อวาน */
export function getShiftDateString(now: Date = new Date()) {
  const d = new Date(now);
  if (d.getHours() < 8) d.setDate(d.getDate() - 1);
  return formatDateString(d);
}

/** ขอบเขตของกะ: 08:00 ของวันที่ระบุ ถึง 07:59:59.999 ของวันถัดไป */
export function getShiftWindow(dateString: string) {
  const start = new Date(`${dateString}T08:00:00`);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 1);
  end.setHours(7, 59, 59, 999);
  return { start, end };
}

/** บวก/ลบวันจากสตริงวันที่ "YYYY-MM-DD" */
export function addDays(dateString: string, days: number) {
  const d = new Date(`${dateString}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatDateString(d);
}

export function formatDateString(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** "2026-09-04T15:10:04.343" -> "15:10" */
export function formatTimeOfDay(isoDateTime: string | null) {
  if (!isoDateTime) return '';
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const STATION_MAP: Record<string, Record<string, string>> = {
  Line1: {
    '1': 'จุดที่ 1',
    '2': 'จุดที่ 2',
    '3': 'จุดที่ 3',
    '4': 'จุดที่ 4',
    '5': 'จุดที่ 5',
    '6': 'จุดที่ 6',
    '7': 'จุดที่ L1-1',
    '8': 'จุดที่ 7',
    '9': 'Vision machine',
    '11': 'Maintenance',
  },
  Line2: {
    '1': 'จุดที่ 1',
    '2': 'จุดที่ 2',
    '3': 'จุดที่ 3',
    '4': 'จุดที่ 4',
    '5': 'จุดที่ 5',
    '6': 'จุดที่ L2-1',
    '7': 'จุดที่ 7',
    '8': 'Vision machine',
    '9': 'Maintenance',
  },
};

/** แปลงเลข station เป็นชื่อจุดที่หยุด ตามไลน์ (null = Line Stop ทั้งไลน์) */
export function formatStopPoint(station: string | number | null, lineName: string) {
  if (station === null || station === undefined) return 'Line Stop';
  const value = String(station);
  if (value === '0') return '';
  return STATION_MAP[lineName]?.[value] ?? `จุดที่ ${value}`;
}

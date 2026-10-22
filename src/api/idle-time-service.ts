import {
  API_BASE_URL,
  AUTH_BASE_URL,
  AUTH_ENDPOINTS,
  ENDPOINTS,
  USE_MOCK_AUTH,
  USE_MOCK_DATA,
  toCdEquip,
} from '@/api/config';
import { AppError, describeEndpoint } from '@/api/app-error';
import { fetchRead, fetchWithTimeout } from '@/api/http';
import {
  formatDateString,
  formatStopPoint,
  formatTimeOfDay,
  getBreakRuleType,
  getShiftWindow,
  MIN_VISIBLE_MINS,
} from '@/api/idle-rules';
import { buildLineTimeline, type LineTimeline } from '@/api/line-timeline';
import { MOCK_RECORDS } from '@/api/mock-data';
import type {
  ApiEnvelope,
  ApiIdleTimeRecord,
  AuthEnvelope,
  IdleTimeRecord,
} from '@/types';

/**
 * เก็บ record ดิบที่โหลดมาล่าสุดไว้ เพราะตอนบันทึกต้องส่ง object เต็มกลับไป
 * (API เป็น PUT ทั้งก้อน ไม่ใช่ PATCH เฉพาะ field ที่แก้)
 */
const rawById = new Map<string, ApiIdleTimeRecord>();

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const init: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string> | undefined) ?? {}),
    },
  };

  // คำสั่งอ่านลองซ้ำได้เพราะไม่เปลี่ยนข้อมูล ส่วน PUT ห้ามลองซ้ำ เดี๋ยวบันทึกสองรอบ
  const isRead = !options.method || options.method.toUpperCase() === 'GET';
  const url = `${API_BASE_URL}${path}`;
  const res = isRead ? await fetchRead(url, init) : await fetchWithTimeout(url, init);
  const endpoint = describeEndpoint(options.method ?? 'GET', url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AppError('HTTP', { status: res.status, serverMessage: text || res.statusText, endpoint });
  }
  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!body) throw new AppError('BAD_RESPONSE', { status: res.status, endpoint });
  if (!body.isSuccess) {
    throw new AppError('REJECTED', {
      status: res.status,
      serverMessage: body.errorMessages?.join(', ') || undefined,
      endpoint,
    });
  }
  return body.result;
}

// ---------- โหลดข้อมูลของกะ + คัดกรองตามกติกาเดียวกับเว็บ ----------

/** ข้อมูลดิบทั้งกะก่อนกรอง ใช้ร่วมกันระหว่างรายการที่ต้องกรอกสาเหตุกับแถบสถานะไลน์ */
async function requestShift(dateString: string, cdEquip: string): Promise<ApiIdleTimeRecord[]> {
  const { start: shiftStart, end: shiftEnd } = getShiftWindow(dateString);

  const qs = new URLSearchParams({
    dateFrom: formatDateString(shiftStart),
    dateTo: formatDateString(shiftEnd),
    cdEquip,
  }).toString();

  return (await request<ApiIdleTimeRecord[]>(`${ENDPOINTS.records}?${qs}`)) ?? [];
}

async function loadShift(
  dateString: string,
  cdEquip: string
): Promise<ApiIdleTimeRecord[]> {
  return selectVisible(await requestShift(dateString, cdEquip), dateString);
}

function selectVisible(raw: ApiIdleTimeRecord[], dateString: string): ApiIdleTimeRecord[] {
  const { start: shiftStart, end: shiftEnd } = getShiftWindow(dateString);
  if (raw.length === 0) return [];

  // อยู่ในกะ หยุดนานพอที่จะต้องกรอกสาเหตุ และไม่ใช่ช่วงพักที่ถูกซ่อนตามกติกา
  const valid = raw.filter((item) => {
    const recordTime = new Date(item.dateTime);
    if (recordTime < shiftStart || recordTime > shiftEnd) return false;
    if ((item.totaltimeoffMins ?? 0) <= MIN_VISIBLE_MINS) return false;
    return getBreakRuleType(item.timestartOff, item.totaltimeoffMins ?? 0) !== 'HIDDEN';
  });

  const byLine = new Map<string, ApiIdleTimeRecord[]>();
  valid.forEach((item) => {
    const line = item.lineName || 'Unknown';
    const list = byLine.get(line);
    if (list) list.push(item);
    else byLine.set(line, [item]);
  });

  const selected: ApiIdleTimeRecord[] = [];

  byLine.forEach((lineData, line) => {
    // เป้าหมายคือค่า totalIdleTime ของ record ล่าสุดในไลน์นั้น (ตัวเลขที่ระบบนับเอง)
    const lineRaw = raw.filter((r) => (r.lineName || 'Unknown') === line);
    const latest = lineRaw.reduce(
      (acc, cur) => (new Date(cur.dateTime) > new Date(acc.dateTime) ? cur : acc),
      lineRaw[0]
    );
    const targetIdleTime = latest?.totalIdleTime ?? 0;

    // รายการยาว (> 0.60 นาที) นับหมด ส่วนรายการสั้นค่อยๆ เติมจนกว่าผลรวมจะถึงเป้า
    //
    // หมายเหตุ: ตอนนี้ smallItems ว่างเสมอ เพราะ valid ด้านบนกรองรายการที่ไม่เกิน
    // MIN_VISIBLE_MINS (1 นาที) ทิ้งไปแล้ว ส่วนนี้จึงไม่มีผลกับผลลัพธ์
    // ที่ยังเก็บไว้เพราะเป็นกติกาที่พอร์ตมาจากเว็บ ถ้าวันหนึ่งลด MIN_VISIBLE_MINS
    // ลงต่ำกว่า 0.6 นาที กติกานี้จะกลับมาทำงานและผลจะตรงกับเว็บเหมือนเดิม
    const mainItems = lineData.filter((item) => (item.totaltimeoffMins ?? 0) > 0.6);
    const smallItems = lineData
      .filter((item) => (item.totaltimeoffMins ?? 0) <= 0.6)
      .sort((a, b) => (b.totaltimeoffMins ?? 0) - (a.totaltimeoffMins ?? 0));

    let sumSeconds = mainItems.reduce((sum, item) => sum + (item.totaltimeOff ?? 0), 0);
    const chosenSmall: ApiIdleTimeRecord[] = [];
    for (const item of smallItems) {
      if (Math.round(sumSeconds / 60) >= targetIdleTime) break;
      chosenSmall.push(item);
      sumSeconds += item.totaltimeOff ?? 0;
    }

    selected.push(...mainItems, ...chosenSmall);
  });

  selected.sort((a, b) => b.id - a.id);
  selected.forEach((item) => rawById.set(String(item.id), item));

  return selected;
}

// ---------- แปลงรูปแบบ API <-> รูปแบบที่หน้าจอใช้ ----------

function toIdleTimeRecord(api: ApiIdleTimeRecord, index: number): IdleTimeRecord {
  const durationMins = api.totaltimeoffMins ?? 0;
  const ruleType = getBreakRuleType(api.timestartOff, durationMins);
  const isBreak =
    ruleType !== null || (api.status ?? '').toLowerCase().includes('break');

  return {
    id: String(api.id),
    no: index + 1,
    date: (api.dateTime ?? '').slice(0, 10),
    line: api.lineName ?? '',
    item: api.lineName ?? '',
    workOrder: api.workOrder ?? '',
    modelSuffix: api.modelSuffix ?? '',
    lotSize: api.lotSize ?? 0,

    idleTimeIssue: api.idletimeIss ?? '',
    action: api.actionDes ?? '',

    startTime: formatTimeOfDay(api.timestartOff),
    endTime: formatTimeOfDay(api.timestartOn),
    totalMins: durationMins,

    breakRuleType: ruleType,

    stopPoint: formatStopPoint(api.station, api.lineName ?? ''),
    vendor: Number(api.venDorTime ?? 0) > 0,
    dj: Number(api.djTime ?? 0) > 0,
    manPower: api.manPower === null || api.manPower === undefined ? '' : String(api.manPower),
    type: api.typeWork ?? '',
    judge: api.judgeWork ?? '',
    reason: api.reason ?? '',
    dept: api.dept ?? '',
    remark: api.remark ?? '',
    status: api.status ?? '',

    isBreakTime: isBreak,
  };
}

/** field ที่ backend ต้องการเป็นจำนวนเต็ม (พอร์ตจาก handleSave ของเว็บ) */
const NUMERIC_KEYS = new Set([
  'totalCounter',
  'totalIdleTime',
  'lineStop',
  'rework',
  'totaltimeOff',
  'totaltimeoffMins',
  'lotSize',
  'venDorTime',
  'djTime',
  'idleTime',
  'manPower',
  'manHour',
  'amountThb',
]);

/**
 * ค่าแรงที่เสียไปต่อหนึ่งนาทีที่ไลน์หยุด (บาท) ตรงกับค่าที่หน้า dashboard ของเว็บใช้
 * เว็บคิด Amount จากนาทีอย่างเดียว ไม่ได้คูณ Man Power
 */
export const AMOUNT_THB_PER_MIN = 229;

/**
 * Man Hour และ Amount ที่แสดงบนจอ คิดแบบเดียวกับตารางบนเว็บ
 * ถ้ายังไม่กรอก Man Power หรือกรอกเป็น 0 เว็บแสดงเป็น 0 ทั้งคู่
 */
export function computeLabourCost(totalMins: number, manPower: string | number) {
  const people = Number(manPower);
  if (manPower === '' || !Number.isFinite(people) || people <= 0) {
    return { manHour: 0, amountThb: 0 };
  }
  return {
    manHour: Math.round((totalMins * people) / 60),
    amountThb: AMOUNT_THB_PER_MIN * totalMins,
  };
}

function applyPatch(raw: ApiIdleTimeRecord, patch: Partial<IdleTimeRecord>): ApiIdleTimeRecord {
  const next: ApiIdleTimeRecord = { ...raw };
  const durationMins = Math.round(raw.totaltimeoffMins ?? 0);

  if (patch.idleTimeIssue !== undefined) next.idletimeIss = patch.idleTimeIssue || null;
  if (patch.action !== undefined) next.actionDes = patch.action || null;
  if (patch.type !== undefined) next.typeWork = patch.type || null;
  if (patch.judge !== undefined) next.judgeWork = patch.judge || null;
  if (patch.reason !== undefined) next.reason = patch.reason || null;
  if (patch.dept !== undefined) next.dept = patch.dept || null;
  if (patch.remark !== undefined) next.remark = patch.remark || null;
  if (patch.manPower !== undefined) {
    next.manPower = patch.manPower === '' ? null : Number(patch.manPower);
    // เว็บคำนวณสองช่องนี้ใหม่ทุกครั้งที่แก้ Man Power แล้วเก็บลงระบบ รายงานค่าเสียหายอ่านจากค่าที่เก็บ
    // ถ้าแอปไม่คำนวณตาม Man Hour กับ Amount จะค้างเป็น 0 หรือค่าเก่า
    // ใช้สูตรเดียวกับ onBlur ของเว็บตรงตัว รวมถึงกรณีล้าง Man Power ที่ Amount ยังคิดตามนาที
    // (ตัวเลขถูกปัดเป็นจำนวนเต็มใน toApiPayload เหมือนตอนเว็บบันทึก)
    const mins = raw.totaltimeoffMins ?? 0;
    next.manHour = (mins * (Number(patch.manPower) || 0)) / 60;
    next.amountThb = AMOUNT_THB_PER_MIN * mins;
  }
  // สวิตช์ในแอปเป็น true/false แต่ฝั่ง backend เก็บเป็นจำนวนนาทีที่โยนให้ vendor/DJ
  // จึงตีความว่า "ใช่" = ยกเวลาหยุดทั้งก้อนให้ฝ่ายนั้น
  // มาถึงตรงนี้เฉพาะเมื่อผู้ใช้กดสวิตช์จริง (ดู diffEditable) ค่าบางส่วนที่เว็บกรอกไว้จึงไม่ถูกทับ
  if (patch.vendor !== undefined) next.venDorTime = patch.vendor ? durationMins : 0;
  if (patch.dj !== undefined) next.djTime = patch.dj ? durationMins : 0;

  return next;
}

function toApiPayload(record: ApiIdleTimeRecord): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  Object.entries(record).forEach(([key, value]) => {
    if (NUMERIC_KEYS.has(key)) {
      payload[key] =
        value !== null && value !== '' && value !== undefined ? Math.round(Number(value)) : 0;
    } else {
      payload[key] = value === '' ? null : value;
    }
  });
  payload.idleTime = payload.totaltimeoffMins;
  return payload;
}

// ---------- Public API ที่หน้าจอเรียกใช้ ----------

export async function fetchRecords(params: {
  line?: string;
  date?: string;
}): Promise<IdleTimeRecord[]> {
  if (USE_MOCK_DATA) {
    await delay(300);
    return MOCK_RECORDS.filter(
      (r) =>
        (!params.line || params.line === 'ALL' || r.line === params.line) &&
        (!params.date || r.date === params.date)
    );
  }
  if (!params.date) return [];
  const records = await loadShift(params.date, toCdEquip(params.line));
  return records.map(toIdleTimeRecord);
}

/**
 * รายการที่ต้องกรอกสาเหตุ พร้อมแถบสถานะของไลน์ที่เลือก จาก request เดียว
 *
 * หน้ารายการเรียกทุกรอบ poll อยู่แล้ว ถ้าแยก request ของแถบสถานะออกไป
 * จะยิงเพิ่มเป็นสองเท่าบน wifi โรงงานโดยได้ข้อมูลชุดเดียวกัน
 *
 * timeline เป็น null เมื่อเลือกทุกไลน์ (แถบนี้แสดงได้ทีละไลน์) หรือใช้ข้อมูลจำลอง
 */
export async function fetchShiftData(params: {
  line?: string;
  date?: string;
}): Promise<{ records: IdleTimeRecord[]; timeline: LineTimeline | null }> {
  if (USE_MOCK_DATA || !params.date) {
    return { records: await fetchRecords(params), timeline: null };
  }

  const cdEquip = toCdEquip(params.line);
  const raw = await requestShift(params.date, cdEquip);
  const records = selectVisible(raw, params.date).map(toIdleTimeRecord);
  const timeline =
    cdEquip === 'ALL'
      ? null
      : buildLineTimeline(
          raw.filter((item) => item.lineName === params.line),
          params.date
        );
  return { records, timeline };
}

/** field ที่หน้ากรอกสาเหตุแก้ได้ — field อื่นเป็นของเครื่องจักรหรือเว็บ แอปห้ามแตะ */
export const EDITABLE_KEYS = [
  'idleTimeIssue',
  'action',
  'vendor',
  'dj',
  'manPower',
  'type',
  'judge',
  'reason',
  'dept',
  'remark',
] as const;

export type EditableKey = (typeof EDITABLE_KEYS)[number];

/** field ที่ผู้ใช้เปลี่ยนจริง เทียบกับค่าตอนเปิดหน้า */
export function diffEditable(
  original: IdleTimeRecord,
  edited: IdleTimeRecord
): Partial<Pick<IdleTimeRecord, EditableKey>> {
  const changes: Partial<Record<EditableKey, unknown>> = {};
  for (const key of EDITABLE_KEYS) {
    if (original[key] !== edited[key]) changes[key] = edited[key];
  }
  return changes as Partial<Pick<IdleTimeRecord, EditableKey>>;
}

/**
 * มีคนแก้ field เดียวกันไปก่อนระหว่างที่ผู้ใช้กรอกอยู่
 * latest คือข้อมูลล่าสุดในระบบ ให้หน้าจอแสดงค่าจริงและให้ผู้ใช้ตัดสินใจเอง
 */
export class RecordConflictError extends Error {
  constructor(
    readonly fields: EditableKey[],
    readonly latest: IdleTimeRecord
  ) {
    super('record-conflict');
    this.name = 'RecordConflictError';
  }
}

/**
 * บันทึกรายการเดียวกลับไปที่ backend
 *
 * ส่งเฉพาะ field ที่ผู้ใช้แก้จริง แล้ววางลงบนข้อมูลที่ดึงมาใหม่ก่อน PUT เสมอ
 * เพราะ API เป็น PUT ทั้งก้อนและไม่มีตัวกันการเขียนทับ ถ้าใช้ข้อมูลใน cache
 * หรือส่งทุก field ที่หน้าจอถืออยู่ สิ่งที่คนอื่นแก้บนเว็บระหว่างนั้นจะถูกทับหายเงียบ ๆ
 * รวมถึง venDorTime/djTime ที่เว็บอาจกรอกไว้เป็นนาทีบางส่วน
 *
 * @param original ค่าตอนผู้ใช้เปิดหน้า ใช้หาว่าผู้ใช้แก้อะไร และมีใครแก้ชนหรือไม่
 * @param edited ค่าที่ผู้ใช้กรอกล่าสุด
 * @param shiftDate วันที่ของกะ ใช้ดึงข้อมูลสดก่อนบันทึก
 * @param overwrite true = ผู้ใช้ยืนยันแล้วว่าให้ทับของคนอื่น
 * @throws RecordConflictError เมื่อ field ที่ผู้ใช้แก้ ถูกแก้บน server ไปแล้วและไม่ได้สั่ง overwrite
 */
export async function updateRecord(
  original: IdleTimeRecord,
  edited: IdleTimeRecord,
  shiftDate: string,
  overwrite = false
): Promise<IdleTimeRecord> {
  const id = original.id;
  const changes = diffEditable(original, edited);
  // ไม่ได้แก้อะไร ไม่ต้องยิง PUT ให้เสี่ยงทับข้อมูลคนอื่นโดยไม่ได้อะไรกลับมา
  if (Object.keys(changes).length === 0) return edited;

  if (USE_MOCK_DATA) {
    await delay(300);
    const idx = MOCK_RECORDS.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error(`ไม่พบรายการ id=${id}`);
    MOCK_RECORDS[idx] = { ...MOCK_RECORDS[idx], ...changes };
    return MOCK_RECORDS[idx];
  }

  // ดึงสดทุกครั้ง ไม่ใช้ cache — เป็นคำสั่งอ่านจึงลองซ้ำเองได้เมื่อสัญญาณสะดุด
  await loadShift(shiftDate, 'ALL');
  const raw = rawById.get(id);
  if (!raw) throw new AppError('RECORD_GONE', { serverMessage: `id=${id} date=${shiftDate}` });

  const latest = toIdleTimeRecord(raw, 0);
  const conflicts = (Object.keys(changes) as EditableKey[]).filter(
    (key) => latest[key] !== original[key]
  );
  if (conflicts.length > 0 && !overwrite) throw new RecordConflictError(conflicts, latest);

  const updated = applyPatch(raw, changes);
  await request<unknown>(ENDPOINTS.updateRecords, {
    method: 'PUT',
    // API รับเป็น array เสมอ แม้จะแก้แค่รายการเดียว
    body: JSON.stringify([toApiPayload(updated)]),
  });

  rawById.set(id, updated);
  return toIdleTimeRecord(updated, 0);
}

/** ดึงรายการเดียว — ใช้ของที่โหลดไว้แล้วก่อน ถ้าไม่มีค่อยโหลดทั้งกะใหม่ */
export async function fetchRecordById(
  id: string,
  date: string
): Promise<IdleTimeRecord | null> {
  if (USE_MOCK_DATA) {
    await delay(300);
    const found = MOCK_RECORDS.find((r) => r.id === id);
    return found ?? null;
  }

  const cached = rawById.get(id);
  if (cached) return toIdleTimeRecord(cached, 0);

  const records = await loadShift(date, 'ALL');
  const found = records.find((r) => String(r.id) === id);
  return found ? toIdleTimeRecord(found, 0) : null;
}

/**
 * ล็อกอินกับ auth service
 * ตอนสำเร็จ result เป็น object { token, expiration, ... }
 * ตอนล้มเหลว API ตอบ HTTP 401 และ result กลายเป็น "string" ข้อความ error แทน
 */
export async function login(
  email: string,
  password: string
): Promise<{ token: string; name: string; expiration: string | null }> {
  if (USE_MOCK_AUTH) {
    await delay(400);
    if (!email || !password) throw new Error('กรุณากรอกอีเมลและรหัสผ่าน');
    return { token: 'mock-token-123', name: email, expiration: null };
  }

  const url = `${AUTH_BASE_URL}${AUTH_ENDPOINTS.login}`;
  const endpoint = describeEndpoint('POST', url);
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const body = (await res.json().catch(() => null)) as AuthEnvelope | null;
  if (!body) throw new AppError(res.ok ? 'BAD_RESPONSE' : 'HTTP', { status: res.status, endpoint });

  // รหัสผ่านผิด auth service ตอบ 401 พร้อมเหตุผลเป็นข้อความ ให้ผู้ใช้เห็นเหตุผลนั้นตรง ๆ
  if (!body.isSuccess || typeof body.result === 'string') {
    const message =
      typeof body.result === 'string' ? body.result : body.errorMessages?.join(', ');
    throw message
      ? new AppError('REJECTED', { status: res.status, serverMessage: message, endpoint })
      : new AppError('HTTP', { status: res.status, endpoint });
  }

  if (!body.result?.token) {
    throw new AppError('BAD_RESPONSE', { status: res.status, serverMessage: 'no token', endpoint });
  }

  return {
    token: body.result.token,
    name: body.email ?? email,
    expiration: body.result.expiration ?? null,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

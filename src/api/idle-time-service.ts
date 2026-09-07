import {
  API_BASE_URL,
  AUTH_BASE_URL,
  AUTH_ENDPOINTS,
  ENDPOINTS,
  USE_MOCK_AUTH,
  USE_MOCK_DATA,
  toCdEquip,
} from '@/api/config';
import {
  formatDateString,
  formatStopPoint,
  formatTimeOfDay,
  getBreakRuleType,
  getShiftWindow,
} from '@/api/idle-rules';
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
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string> | undefined) ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  const body = (await res.json()) as ApiEnvelope<T>;
  if (!body.isSuccess) {
    throw new Error(body.errorMessages?.join(', ') || 'API ตอบกลับว่าไม่สำเร็จ');
  }
  return body.result;
}

// ---------- โหลดข้อมูลของกะ + คัดกรองตามกติกาเดียวกับเว็บ ----------

async function loadShift(
  dateString: string,
  cdEquip: string
): Promise<ApiIdleTimeRecord[]> {
  const { start: shiftStart, end: shiftEnd } = getShiftWindow(dateString);

  const qs = new URLSearchParams({
    dateFrom: formatDateString(shiftStart),
    dateTo: formatDateString(shiftEnd),
    cdEquip,
  }).toString();

  const raw = (await request<ApiIdleTimeRecord[]>(`${ENDPOINTS.records}?${qs}`)) ?? [];
  if (raw.length === 0) return [];

  // อยู่ในกะ และไม่ใช่ช่วงพักที่ถูกซ่อนตามกติกา
  const valid = raw.filter((item) => {
    const recordTime = new Date(item.dateTime);
    if (recordTime < shiftStart || recordTime > shiftEnd) return false;
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

    stopPoint: formatStopPoint(api.station, api.lineName ?? ''),
    vendor: Number(api.venDorTime ?? 0) > 0,
    dj: Number(api.djTime ?? 0) > 0,
    manPower: api.manPower === null || api.manPower === undefined ? '' : String(api.manPower),
    type: api.typeWork ?? '',
    dept: api.dept ?? '',
    remark: api.remark ?? '',

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

function applyPatch(raw: ApiIdleTimeRecord, patch: Partial<IdleTimeRecord>): ApiIdleTimeRecord {
  const next: ApiIdleTimeRecord = { ...raw };
  const durationMins = Math.round(raw.totaltimeoffMins ?? 0);

  if (patch.idleTimeIssue !== undefined) next.idletimeIss = patch.idleTimeIssue || null;
  if (patch.action !== undefined) next.actionDes = patch.action || null;
  if (patch.type !== undefined) next.typeWork = patch.type || null;
  if (patch.dept !== undefined) next.dept = patch.dept || null;
  if (patch.remark !== undefined) next.remark = patch.remark || null;
  if (patch.manPower !== undefined) {
    next.manPower = patch.manPower === '' ? null : Number(patch.manPower);
  }
  // สวิตช์ในแอปเป็น true/false แต่ฝั่ง backend เก็บเป็นจำนวนนาทีที่โยนให้ vendor/DJ
  // จึงตีความว่า "ใช่" = ยกเวลาหยุดทั้งก้อนให้ฝ่ายนั้น
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

export async function updateRecord(
  id: string,
  patch: Partial<IdleTimeRecord>
): Promise<IdleTimeRecord> {
  if (USE_MOCK_DATA) {
    await delay(300);
    const idx = MOCK_RECORDS.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error(`ไม่พบรายการ id=${id}`);
    MOCK_RECORDS[idx] = { ...MOCK_RECORDS[idx], ...patch };
    return MOCK_RECORDS[idx];
  }

  const raw = rawById.get(id);
  if (!raw) throw new Error(`ไม่พบข้อมูลต้นฉบับของรายการ id=${id} กรุณาโหลดรายการใหม่`);

  const updated = applyPatch(raw, patch);
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

  const res = await fetch(`${AUTH_BASE_URL}${AUTH_ENDPOINTS.login}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const body = (await res.json().catch(() => null)) as AuthEnvelope | null;
  if (!body) throw new Error(`เชื่อมต่อ auth service ไม่ได้ (HTTP ${res.status})`);

  if (!body.isSuccess || typeof body.result === 'string') {
    const message =
      typeof body.result === 'string' ? body.result : body.errorMessages?.join(', ');
    throw new Error(message || `เข้าสู่ระบบไม่สำเร็จ (HTTP ${res.status})`);
  }

  if (!body.result?.token) throw new Error('auth service ไม่ได้ส่ง token กลับมา');

  return {
    token: body.result.token,
    name: body.email ?? email,
    expiration: body.result.expiration ?? null,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ล็อก "มีคนกำลังกรอกรายการนี้อยู่" ผ่าน notify-server (notify-server/src/presence.js)
 *
 * ทุกฟังก์ชันล้มแบบเงียบ คืน null เมื่อติดต่อ server ไม่ได้ (รวม server รุ่นเก่าที่ยังไม่มีเส้นนี้)
 * ผู้เรียกต้องถือว่า null = "ไม่รู้" แล้วปล่อยให้กรอกได้ตามปกติ
 * ล็อกเป็นตัวช่วยกันชน ไม่ใช่เหตุให้หน้างานบันทึกไม่ได้ตอน server ล่ม
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ENDPOINTS, NOTIFY_SERVER_URL } from '@/api/config';
import { fetchWithTimeout } from '@/api/http';

/** สั้นกว่า timeout ปกติ ล็อกเป็นของเสริม ไม่ควรรอนาน */
const PRESENCE_TIMEOUT_MS = 5_000;
const DEVICE_ID_KEY = 'presence-device-id';

export interface PresenceHolder {
  userName: string;
  since: number;
}

export interface HeartbeatResult {
  /** true = เครื่องนี้ถือล็อก แก้ได้ */
  granted: boolean;
  holder: PresenceHolder | null;
}

export interface PresenceEntry {
  recordId: string;
  deviceId: string;
  userName: string;
  since: number;
}

let deviceIdPromise: Promise<string> | null = null;

/**
 * รหัสเครื่องแบบสุ่ม เก็บไว้ถาวร ใช้แยกว่าใครถือล็อก
 * ใช้รหัสเครื่องแทนชื่อผู้ใช้ เพราะคนเดียวเปิดสองเครื่องก็เขียนทับกันเองได้เหมือนกัน
 */
export function getDeviceId(): Promise<string> {
  deviceIdPromise ??= (async () => {
    try {
      const saved = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (saved) return saved;
    } catch {
      // อ่านไม่ได้ก็สร้างใหม่ ผลเสียแค่ล็อกเดิมของเครื่องนี้หลุดตาม TTL
    }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    try {
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    } catch {
      // ใช้ค่าในหน่วยความจำต่อไป
    }
    return id;
  })();
  return deviceIdPromise;
}

async function post<T>(path: string, body: object): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(
      `${NOTIFY_SERVER_URL}${path}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      PRESENCE_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T };
    return json.result ?? null;
  } catch {
    return null;
  }
}

/** จองหรือต่ออายุล็อก คืน null เมื่อติดต่อไม่ได้ */
export async function presenceHeartbeat(
  date: string,
  recordId: string,
  userName: string | null,
): Promise<HeartbeatResult | null> {
  const deviceId = await getDeviceId();
  return post<HeartbeatResult>(ENDPOINTS.presenceHeartbeat, {
    date,
    recordId,
    deviceId,
    userName: userName ?? '-',
  });
}

/** ปล่อยล็อกตอนออกจากหน้ากรอก ไม่สำเร็จก็ไม่เป็นไร ล็อกหลุดเองตาม TTL ของ server */
export async function presenceRelease(date: string, recordId: string): Promise<void> {
  const deviceId = await getDeviceId();
  await post(ENDPOINTS.presenceRelease, { date, recordId, deviceId });
}

/**
 * ใครกำลังกรอกรายการไหนอยู่บ้างในวันนั้น ไม่รวมเครื่องนี้เอง
 * @returns Map ของ recordId → ชื่อผู้กรอก, null เมื่อติดต่อไม่ได้
 */
export async function fetchPresence(date: string): Promise<Map<string, string> | null> {
  try {
    const [deviceId, res] = await Promise.all([
      getDeviceId(),
      fetchWithTimeout(
        `${NOTIFY_SERVER_URL}${ENDPOINTS.presence}?date=${encodeURIComponent(date)}`,
        {},
        PRESENCE_TIMEOUT_MS,
      ),
    ]);
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: PresenceEntry[] };
    const map = new Map<string, string>();
    for (const e of json.result ?? []) {
      if (e.deviceId !== deviceId) map.set(String(e.recordId), e.userName);
    }
    return map;
  } catch {
    return null;
  }
}

/** หน่วงก่อนต่อท่อใหม่ เพิ่มขึ้นทีละเท่าจนถึงเพดาน ไม่ยิงถี่ใส่ server ตอนมันล่ม */
const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 15_000;

/**
 * รับรายการล็อกของวันนั้นแบบเรียลไทม์ผ่าน WebSocket (ws://<notify-server>/api/v1/Presence/ws)
 * เรียก onUpdate ทันทีที่ต่อติด และทุกครั้งที่มีคนเปิด/ออกจากหน้ากรอก (ไม่รวมเครื่องนี้เอง)
 * หลุดแล้วต่อใหม่เอง ผู้เรียกควรถาม fetchPresence เป็นระยะไว้ด้วยเป็นตัวสำรองตอนต่อไม่ติด
 * @returns ฟังก์ชันปิดท่อ เรียกตอนออกจากหน้า
 */
export function subscribePresence(
  date: string,
  onUpdate: (editing: Map<string, string>) => void
): () => void {
  let closed = false;
  let ws: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let delay = RECONNECT_MIN_MS;
  const url = `${NOTIFY_SERVER_URL.replace(/^http/, 'ws')}${ENDPOINTS.presence}/ws`;

  const connect = async () => {
    const deviceId = await getDeviceId();
    if (closed) return;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      delay = RECONNECT_MIN_MS;
      ws?.send(JSON.stringify({ type: 'subscribe', date }));
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(String(e.data)) as {
          type?: string;
          date?: string;
          result?: PresenceEntry[];
        };
        if (msg.type !== 'presence' || msg.date !== date) return;
        const map = new Map<string, string>();
        for (const entry of msg.result ?? []) {
          if (entry.deviceId !== deviceId) map.set(String(entry.recordId), entry.userName);
        }
        onUpdate(map);
      } catch {
        // ข้อความเพี้ยนข้ามไป รอข้อความถัดไป
      }
    };
    ws.onclose = () => scheduleReconnect();
    // onerror ตามด้วย onclose เสมอ ต่อใหม่ที่ onclose ที่เดียว
    ws.onerror = () => {};
  };

  const scheduleReconnect = () => {
    ws = null;
    if (closed || retry) return;
    retry = setTimeout(() => {
      retry = null;
      void connect();
    }, delay);
    delay = Math.min(delay * 2, RECONNECT_MAX_MS);
  };

  void connect();
  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    ws?.close();
    ws = null;
  };
}

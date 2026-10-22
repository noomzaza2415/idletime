import {
  discardFile,
  findSavedMatch,
  loadQueue,
  saveQueue,
  stagePhoto,
  type QueuedPhoto,
} from '@/api/photo-queue';
import {
  getRecordPhotos,
  PhotoUploadError,
  uploadRecordPhoto,
  type PickedPhoto,
  type RecordPhoto,
} from '@/api/photo-store';

/**
 * ตัวส่งรูปที่อยู่ระดับแอป ไม่ผูกกับหน้าจอ
 *
 * ถ้าผูกไว้กับหน้ากรอกสาเหตุ ผู้ใช้กดย้อนกลับแล้วเปิดรายการเดิมอีกครั้งระหว่างที่ยังส่งอยู่
 * จะมีสองรอบวิ่งส่งคิวเดียวกันพร้อมกัน ได้รูปซ้ำบน server
 * จึงเก็บสถานะไว้ที่นี่ที่เดียวต่อหนึ่งรายการ หน้าจอแค่มาดูและสั่งงาน
 *
 * ส่งทีละใบตามลำดับ ใบที่ล้มถูกพักไว้พร้อมข้อความ ไม่ขวางใบถัดไป
 */

export interface UploaderState {
  queue: QueuedPhoto[];
  /** รูปในคิวที่กำลังส่งอยู่ */
  activeKey: string | null;
  /** ความคืบหน้าของใบที่กำลังส่ง 0-1 */
  progress: number;
  /** จำนวนรูปที่กำลังย่อและคัดลอก ยังไม่เข้าคิว */
  staging: number;
  /** รูปที่ส่งสำเร็จในรอบนี้ หน้าจอเอาไปรวมกับรายการที่โหลดจาก server */
  saved: RecordPhoto[];
  /** อ่านคิวจากเครื่องเสร็จแล้ว ก่อนหน้านั้นยังไม่รู้ว่ามีรูปค้างหรือไม่ */
  loaded: boolean;
}

const EMPTY: UploaderState = {
  queue: [],
  activeKey: null,
  progress: 0,
  staging: 0,
  saved: [],
  loaded: false,
};

const states = new Map<string, UploaderState>();
const listeners = new Map<string, Set<() => void>>();
const running = new Set<string>();
const loading = new Map<string, Promise<void>>();
/** ชื่อผู้ใช้ที่สั่งส่งล่าสุด server จดไว้ว่าใครแนบรูป */
const senders = new Map<string, string | null | undefined>();
/** เวลาที่รู้ว่ารูปแต่ละใบอยู่บน server (key = recordId/fileName) ใช้ตัดสินว่ารายการที่โหลดใหม่สดกว่าหรือไม่ */
const savedAt = new Map<string, number>();

export function getUploaderState(recordId: string): UploaderState {
  return states.get(recordId) ?? EMPTY;
}

export function subscribeUploader(recordId: string, listener: () => void) {
  let set = listeners.get(recordId);
  if (!set) {
    set = new Set();
    listeners.set(recordId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

/** สร้าง object ใหม่ทุกครั้ง ให้ useSyncExternalStore รู้ว่ามีการเปลี่ยนแปลง */
function update(recordId: string, patch: Partial<UploaderState>) {
  states.set(recordId, { ...getUploaderState(recordId), ...patch });
  listeners.get(recordId)?.forEach((fn) => fn());
}

function setQueue(recordId: string, queue: QueuedPhoto[]) {
  update(recordId, { queue });
  void saveQueue(recordId, queue);
}

function patchItem(recordId: string, key: string, patch: Partial<QueuedPhoto>) {
  setQueue(
    recordId,
    getUploaderState(recordId).queue.map((q) => (q.key === key ? { ...q, ...patch } : q))
  );
}

/**
 * รับได้หลายใบ เพราะผลอัปโหลดคือรูปทั้งหมดของรายการ ไม่ใช่เฉพาะใบที่เพิ่งส่ง
 * รวมทุกใบที่ยังไม่มี ตัดซ้ำด้วยชื่อไฟล์ ลำดับยังเป็นตามที่ server เรียงไว้ (เก่าไปใหม่)
 */
function markSaved(recordId: string, key: string, photos: RecordPhoto[]) {
  const state = getUploaderState(recordId);
  const item = state.queue.find((q) => q.key === key);
  if (item) discardFile(item);
  const known = new Set(state.saved.map((p) => p.fileName));
  const now = Date.now();
  for (const p of photos) savedAt.set(`${recordId}/${p.fileName}`, now);
  update(recordId, {
    saved: [...state.saved, ...photos.filter((p) => !known.has(p.fileName))],
  });
  setQueue(
    recordId,
    getUploaderState(recordId).queue.filter((q) => q.key !== key)
  );
}

/** อ่านคิวที่ค้างอยู่ในเครื่อง ทำครั้งเดียวต่อรายการ เรียกซ้ำได้ไม่เป็นไร */
export function loadUploader(recordId: string): Promise<void> {
  if (getUploaderState(recordId).loaded) return Promise.resolve();
  let pending = loading.get(recordId);
  if (!pending) {
    pending = loadQueue(recordId).then((queue) => {
      // ระหว่างอ่านอาจมีรูปใหม่เข้าคิวไปแล้ว ต้องรวม ไม่ใช่เขียนทับ
      const current = getUploaderState(recordId).queue;
      const merged = [...queue.filter((q) => !current.some((c) => c.key === q.key)), ...current];
      update(recordId, { queue: merged, loaded: true });
      loading.delete(recordId);
    });
    loading.set(recordId, pending);
  }
  return pending;
}

/**
 * ย่อรูปแล้วเข้าคิว จากนั้นเริ่มส่ง
 *
 * เก็บลงเครื่องก่อนส่งเสมอ ถ้าแอปถูกปิดหรือ wifi หลุดกลางทาง รูปยังอยู่ให้ส่งต่อได้
 */
export async function enqueuePhotos(
  recordId: string,
  photos: PickedPhoto[],
  userName?: string | null,
  cdEquip?: string | null
) {
  if (photos.length === 0) return;
  senders.set(recordId, userName);
  await loadUploader(recordId);
  update(recordId, { staging: getUploaderState(recordId).staging + photos.length });
  for (const photo of photos) {
    try {
      const item = { ...(await stagePhoto(photo)), cdEquip };
      setQueue(recordId, [...getUploaderState(recordId).queue, item]);
    } finally {
      update(recordId, { staging: getUploaderState(recordId).staging - 1 });
    }
  }
  void run(recordId);
}

/**
 * ส่งต่อรูปที่ค้างในคิวจากรอบก่อน เช่นแอปถูกปิดระหว่างส่ง
 * ใบที่เคยล้มพร้อมข้อความยังรอให้ผู้ใช้กดส่งใหม่เอง ไม่ยิงซ้ำให้อัตโนมัติ
 */
export function resumeUploader(recordId: string, userName?: string | null) {
  senders.set(recordId, userName);
  void run(recordId);
}

/** ล้างข้อความผิดพลาดแล้วส่งใหม่ ไม่ระบุ key = ส่งใหม่ทุกใบที่ล้ม */
export function retryPhotos(recordId: string, userName?: string | null, key?: string) {
  senders.set(recordId, userName);
  setQueue(
    recordId,
    getUploaderState(recordId).queue.map((q) =>
      !key || q.key === key ? { ...q, error: undefined } : q
    )
  );
  void run(recordId);
}

/** ทิ้งรูปที่ยังไม่ได้ส่ง ใบที่กำลังส่งอยู่ทิ้งไม่ได้ เพราะไม่รู้ว่า server จะได้ไปหรือไม่ */
export function discardPhoto(recordId: string, key: string) {
  const state = getUploaderState(recordId);
  if (state.activeKey === key) return;
  const item = state.queue.find((q) => q.key === key);
  if (item) discardFile(item);
  setQueue(
    recordId,
    state.queue.filter((q) => q.key !== key)
  );
}

/** รูปที่หน้าจอลบออกจาก server ไปแล้ว ต้องเอาออกจากรายการที่ส่งสำเร็จด้วย */
export function forgetSaved(recordId: string, fileName: string) {
  const state = getUploaderState(recordId);
  update(recordId, { saved: state.saved.filter((p) => p.fileName !== fileName) });
}

/**
 * เอารายการรูปล่าสุดจาก server มาเทียบกับรูปที่เคยส่งแล้วไม่รู้ผล
 * ใบที่ server มีแล้วถือว่าส่งสำเร็จ ไม่ต้องส่งซ้ำ
 *
 * และล้างรูปใน saved ที่ server ไม่มีแล้ว (ถูกลบจากเครื่องอื่นหรือจากเว็บ) ไม่งั้นค้างบนจอจนปิดแอป
 * ล้างเฉพาะใบที่รู้ว่าอยู่บน server ก่อน requestedAt (เวลาที่เริ่มขอรายการนี้)
 * ใบที่ส่งเสร็จระหว่างรอคำตอบอาจยังไม่อยู่ในรายการ ห้ามล้าง
 */
export function reconcileUploader(
  recordId: string,
  serverPhotos: RecordPhoto[],
  requestedAt: number
) {
  const onServer = new Set(serverPhotos.map((p) => p.fileName));
  const before = getUploaderState(recordId).saved;
  const kept = before.filter(
    (p) => onServer.has(p.fileName) || (savedAt.get(`${recordId}/${p.fileName}`) ?? 0) >= requestedAt
  );
  if (kept.length !== before.length) update(recordId, { saved: kept });

  const state = getUploaderState(recordId);
  const taken = new Set<string>();
  for (const item of state.queue) {
    if (item.key === state.activeKey) continue;
    const match = findSavedMatch(item, serverPhotos, taken);
    if (match) {
      taken.add(match.fileName);
      markSaved(recordId, item.key, [match]);
    }
  }
}

async function run(recordId: string) {
  if (running.has(recordId)) return;
  running.add(recordId);
  try {
    for (;;) {
      const next = getUploaderState(recordId).queue.find((q) => !q.error);
      if (!next) break;
      update(recordId, { activeKey: next.key, progress: 0 });

      // ครั้งก่อนส่งไปแล้วไม่รู้ผล ถาม server ก่อนว่าได้ไปหรือยัง
      if (next.uncertainAt) {
        try {
          const onServer = await getRecordPhotos(recordId);
          const match = findSavedMatch(next, onServer, new Set());
          if (match) {
            markSaved(recordId, next.key, [match]);
            continue;
          }
        } catch {
          // เช็กไม่ได้แปลว่ายังต่อ server ไม่ติด ส่งไปก็ไม่ถึง พักไว้ให้กดใหม่
          patchItem(recordId, next.key, { error: 'เชื่อมต่อ server ไม่ได้ ตรวจสอบ wifi' });
          continue;
        }
      }

      const startedAt = Date.now();
      patchItem(recordId, next.key, { sendingAt: startedAt });
      try {
        const saved = await uploadRecordPhoto(recordId, next.uri, senders.get(recordId), next.cdEquip, (p) =>
          update(recordId, { progress: p })
        );
        markSaved(recordId, next.key, saved);
      } catch (e) {
        const err =
          e instanceof PhotoUploadError ? e : new PhotoUploadError(String(e), false);
        patchItem(recordId, next.key, {
          sendingAt: undefined,
          error: err.message,
          // เก็บเวลาที่ไม่แน่ใจครั้งแรกไว้ ถ้าส่งรอบหลังล้มแบบชัดเจน รอบแรกก็ยังอาจถึง server
          uncertainAt: err.maybeSaved ? (next.uncertainAt ?? startedAt) : next.uncertainAt,
        });
      }
    }
  } finally {
    running.delete(recordId);
    update(recordId, { activeKey: null, progress: 0 });
  }
}

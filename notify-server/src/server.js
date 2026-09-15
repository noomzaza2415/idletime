import express from 'express';

import { FcmSender } from './fcm.js';
import { FirestoreStore } from './firestore-store.js';
import { createPhotoRouter, PHOTO_ROUTE } from './photo-routes.js';
import { PhotoStore } from './photo-store.js';
import { TokenStore } from './store.js';
import { IdleTimeWatcher } from './watcher.js';

const PORT = Number(process.env.PORT ?? 8090);
const DATA_FILE = process.env.DATA_FILE ?? './data/tokens.json';

/**
 * ที่เก็บรูปแนบของรายการ idle time
 * วางไว้ใต้ ./data เพราะ compose mount โฟลเดอร์นี้ออกมานอก container อยู่แล้ว
 * รูปจึงอยู่รอดเมื่อลบหรือ build container ใหม่ โดยไม่ต้องเพิ่ม volume
 */
const PHOTO_DIR = process.env.PHOTO_DIR ?? './data/photos';
const PHOTO_INDEX = process.env.PHOTO_INDEX ?? './data/photos.json';
const SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT ?? './firebase-service-account.json';

/** API ของ Idle Time ที่ watcher จะไปถามหารายการใหม่ */
const IDLE_API_URL = process.env.IDLE_API_URL ?? 'http://192.168.2.5:5053';
const IDLE_RECORDS_PATH =
  process.env.IDLE_RECORDS_PATH ?? '/api/v1/IdleTime/GetLineIdleTimeDtoAsync';

/** ความถี่ในการถามหารายการใหม่ ตั้ง 0 เพื่อปิด watcher แล้วยิงผ่าน /Notify เอง */
const WATCH_INTERVAL_MS = Number(process.env.WATCH_INTERVAL_MS ?? 60_000);

/**
 * อ่าน token จาก Firestore ด้วย นอกเหนือจากไฟล์ในเครื่อง
 * เปิดไว้เพื่อให้มือถือที่อยู่นอกวง LAN ลงทะเบียนเองได้ผ่าน Firestore
 * ตั้ง false ถ้ายังไม่ได้สร้าง Firestore database ในโปรเจกต์ Firebase
 */
const USE_FIRESTORE = (process.env.USE_FIRESTORE ?? 'true') !== 'false';

/**
 * กุญแจสำหรับให้ระบบอื่นเรียก /notify ได้
 *
 * บริการนี้ออกแบบให้เปิดสู่อินเทอร์เน็ตเพื่อให้มือถือนอกโรงงานลงทะเบียนได้
 * ถ้าไม่มีกุญแจ ใครก็ยิงแจ้งเตือนเข้าเครื่องพนักงานทุกเครื่องได้ จึงบังคับให้ตั้งเสมอ
 */
const API_KEY = process.env.NOTIFY_API_KEY;
if (!API_KEY) {
  console.error('ต้องตั้ง NOTIFY_API_KEY ก่อนเริ่มบริการ (ดู .env.example)');
  process.exit(1);
}

const store = new TokenStore(DATA_FILE);
const photos = new PhotoStore(PHOTO_DIR, PHOTO_INDEX);

let fcm;
/** @type {FirestoreStore | null} */
let firestore = null;
try {
  fcm = new FcmSender(SERVICE_ACCOUNT);
  console.log(`เชื่อม Firebase project: ${fcm.projectId}`);
  if (USE_FIRESTORE) {
    firestore = new FirestoreStore(fcm.app);
    console.log('อ่าน token จาก Firestore ด้วย (collection: devices)');
  }
} catch (err) {
  console.error(`อ่าน service account ไม่ได้ที่ ${SERVICE_ACCOUNT}: ${err.message}`);
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '64kb' }));

/** ตรวจกุญแจเฉพาะ endpoint ที่ยิงแจ้งเตือนได้ ส่วนการลงทะเบียนเครื่องเปิดให้แอปเรียกตรง */
function requireApiKey(req, res, next) {
  if (req.get('x-api-key') !== API_KEY) {
    return res.status(401).json({ isSuccess: false, errorMessages: ['API key ไม่ถูกต้อง'] });
  }
  next();
}

app.get('/health', async (_req, res) => {
  const local = store.stats();
  let remote = null;
  if (firestore) {
    try {
      remote = await firestore.stats();
    } catch (err) {
      remote = { error: err.message };
    }
  }
  res.json({
    isSuccess: true,
    result: { status: 'ok', local, firestore: remote, photos: photos.stats() },
  });
});

/** เส้น API ของรูปแนบ ดูรายละเอียดใน photo-routes.js */
app.use(PHOTO_ROUTE, createPhotoRouter(photos));

/**
 * แอปมือถือเรียกมาตอนเปิดใช้งาน เพื่อฝาก FCM token ไว้
 * เรียกซ้ำได้ เครื่องเดิมจะอัปเดตแถวเดิม ไม่เกิดข้อมูลซ้ำ
 */
app.post('/api/v1/Notification/RegisterDevice', (req, res) => {
  const { token, platform, userName } = req.body ?? {};

  if (typeof token !== 'string' || token.length < 20) {
    return res
      .status(400)
      .json({ isSuccess: false, errorMessages: ['token ไม่ถูกต้อง'] });
  }

  const outcome = store.register(token, String(platform ?? 'unknown'), userName ?? null);
  console.log(`ลงทะเบียนเครื่อง (${outcome}) platform=${platform} user=${userName ?? '-'}`);

  res.json({ isSuccess: true, result: outcome });
});

/**
 * ระบบหลัง (เช่น job ที่ตรวจเจอไลน์หยุด) เรียกมาเพื่อยิงแจ้งเตือนเข้าทุกเครื่อง
 *
 * body: { title, body, target?: { recordId, date } }
 * target ทำให้ผู้ใช้กดแจ้งเตือนแล้วเด้งเข้าหน้ากรอกสาเหตุของรายการนั้นทันที
 */
app.post('/api/v1/Notification/Notify', requireApiKey, async (req, res) => {
  const { title, body, target } = req.body ?? {};

  if (!title || !body) {
    return res
      .status(400)
      .json({ isSuccess: false, errorMessages: ['ต้องระบุ title และ body'] });
  }


  try {
    const result = await sendOnce(title, body, target);
    res.json({ isSuccess: true, result });
  } catch (err) {
    // แจ้งเตือนเป็นของเสริม ตอบ error กลับไปแต่ไม่ให้บริการล้ม
    console.error('ส่งแจ้งเตือนไม่สำเร็จ:', err.message);
    res.status(502).json({ isSuccess: false, errorMessages: [err.message] });
  }
});

/** รวม token ที่ยังใช้งานได้จากทั้งไฟล์ในเครื่องและ Firestore โดยตัดตัวซ้ำออก */
async function collectTokens() {
  const local = store.activeTokens();
  if (!firestore) return local;

  try {
    const remote = await firestore.activeTokens();
    // เครื่องเดียวกันอาจลงทะเบียนไว้ทั้งสองที่ Set จึงตัดซ้ำให้ ไม่งั้นจะเด้งสองครั้ง
    return [...new Set([...local, ...remote])];
  } catch (err) {
    // Firestore ล่มไม่ควรทำให้แจ้งเตือนหยุดทั้งหมด ยังส่งให้เครื่องที่อยู่ในไฟล์ได้
    console.error('อ่าน token จาก Firestore ไม่สำเร็จ:', err.message);
    return local;
  }
}

/**
 * ส่งแจ้งเตือนหนึ่งรอบไปทุกเครื่องที่ยังใช้งานได้ แล้วปิด token ที่ตายแล้ว
 *
 * ยิงรอบเดียวเท่านั้น ไม่มีการเตือนซ้ำ เพราะรายการเดิมที่ยังไม่ถูกกรอกสาเหตุ
 * จะเด้งซ้ำอีกครั้งกลายเป็นรบกวนพนักงานโดยไม่ได้ข้อมูลเพิ่ม
 *
 * @returns {Promise<{sent: number, failed: number, deactivated: number}>}
 */
async function sendOnce(title, body, target) {
  const tokens = await collectTokens();
  if (tokens.length === 0) return { sent: 0, failed: 0, deactivated: 0 };

  const { sent, failed, deadTokens } = await fcm.send(tokens, { title, body, target });

  let deactivated = store.deactivate(deadTokens);
  if (firestore && deadTokens.length > 0) {
    try {
      deactivated += await firestore.deactivate(deadTokens);
    } catch (err) {
      console.error('ปิด token ตายใน Firestore ไม่สำเร็จ:', err.message);
    }
  }

  console.log(`ส่งแจ้งเตือน: สำเร็จ ${sent} ล้มเหลว ${failed} ปิด token ตาย ${deactivated}`);
  return { sent, failed, deactivated };
}

/** "2026-09-07T15:59:16.95" -> "15:59" คืนค่าว่างถ้ารูปแบบไม่ตรง จะได้ไม่โชว์ขยะในแจ้งเตือน */
function timeOfDay(isoDateTime) {
  const t = String(isoDateTime ?? '').slice(11, 16);
  return /^\d{2}:\d{2}$/.test(t) ? t : '';
}

/** ตัดทศนิยมที่ไม่จำเป็นทิ้ง: 0.93 -> "0.93", 2 -> "2" ให้อ่านง่ายบนหน้าจอล็อก */
function formatMins(value) {
  return String(Number((Number(value) || 0).toFixed(2)));
}

/**
 * แต่งหัวเรื่องและเนื้อความแจ้งเตือนจากรายการที่เพิ่งเข้ามา
 *
 * เนื้อหาที่ใส่คือสิ่งที่พนักงานต้องใช้ตัดสินใจว่าจะรีบไปดูไหม โดยไม่ต้องเปิดแอปก่อน
 * คือ ไลน์ไหนหยุด หยุดกี่นาที ตอนกี่โมง และเป็น work order ใด
 *
 * หัวเรื่องเอาชื่อไลน์ขึ้นก่อนเสมอ เพราะบนหน้าจอล็อกมักเห็นแค่บรรทัดแรก
 * ยกเว้นกรณีหลายไลน์พร้อมกันที่ระบุไลน์เดียวไม่ได้ จึงยกไปไว้ในเนื้อความแทน
 */
function describeRecords(records) {
  const list = Array.isArray(records) ? records : [];
  if (list.length === 0) {
    return { title: 'มีรายการหยุดไลน์ใหม่', body: 'รอระบุสาเหตุ' };
  }

  const totalMins = list.reduce((sum, r) => sum + (Number(r.totaltimeoffMins) || 0), 0);

  // นับแยกตามไลน์ เพื่อบอกได้ว่ากระจุกอยู่ไลน์เดียวหรือหลายไลน์พร้อมกัน
  const countByLine = new Map();
  for (const r of list) {
    const line = r.lineName || 'ไม่ระบุไลน์';
    countByLine.set(line, (countByLine.get(line) ?? 0) + 1);
  }
  const lines = [...countByLine.keys()];

  // ไม่เชื่อลำดับที่ API ส่งมา จึงหาเวลาล่าสุดเอง
  const latest = timeOfDay(
    list.map((r) => r.timestartOff).filter(Boolean).sort().at(-1)
  );

  if (list.length === 1) {
    const r = list[0];
    const at = timeOfDay(r.timestartOff);
    const detail = [
      at && `เวลา ${at}`,
      r.workOrder && `WO ${r.workOrder}`,
      'รอระบุสาเหตุ',
    ].filter(Boolean);

    return {
      title: `${lines[0]} หยุด ${formatMins(r.totaltimeoffMins)} นาที`,
      body: detail.join(' · '),
    };
  }

  if (lines.length === 1) {
    const detail = [
      `รวม ${formatMins(totalMins)} นาที`,
      latest && `ล่าสุด ${latest}`,
      'รอระบุสาเหตุ',
    ].filter(Boolean);

    return {
      title: `${lines[0]} หยุด ${list.length} รายการ`,
      body: detail.join(' · '),
    };
  }

  const perLine = lines.map((line) => `${line} ${countByLine.get(line)}`).join(' · ');
  const detail = [perLine, `รวม ${formatMins(totalMins)} นาที`, 'รอระบุสาเหตุ'];

  return {
    title: `มีรายการหยุดไลน์ใหม่ ${list.length} รายการ`,
    body: detail.join(' · '),
  };
}

app.listen(PORT, '0.0.0.0', () => {
  const { total, active } = store.stats();
  console.log(`บริการแจ้งเตือนพร้อมใช้งานที่พอร์ต ${PORT}`);
  console.log(`เครื่องที่ลงทะเบียนไว้: ${active} ใช้งานได้ จากทั้งหมด ${total}`);

  if (WATCH_INTERVAL_MS <= 0) {
    console.log('ปิดการเฝ้าดูรายการใหม่ไว้ (WATCH_INTERVAL_MS=0) รอให้ระบบอื่นเรียก /Notify เอง');
    return;
  }

  new IdleTimeWatcher({
    apiBaseUrl: IDLE_API_URL,
    recordsPath: IDLE_RECORDS_PATH,
    intervalMs: WATCH_INTERVAL_MS,
    onNewRecords: (records, target) => {
      const { title, body } = describeRecords(records);
      void sendOnce(title, body, target).catch((err) =>
        console.error('ยิงแจ้งเตือนอัตโนมัติไม่สำเร็จ:', err.message)
      );
    },
  }).start();
});

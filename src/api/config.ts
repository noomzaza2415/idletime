// ==========================================================
// ค่าตั้งของ backend จริง (ชุดเดียวกับที่เว็บ idletime ใช้)
// อ้างอิงจาก .env.production ของโปรเจกต์เว็บ
// ==========================================================

/** API หลักของ Idle Time — ตรงกับ NEXT_PUBLIC_VITE_APP_URL_IDLE_TIME_API */
export const API_BASE_URL = 'http://192.168.2.5:5053';

/** service สำหรับ authentication */
export const AUTH_BASE_URL = 'http://192.168.2.5:8081';

/** false = ยิง request จริงไปที่ API_BASE_URL, true = ใช้ mock เพื่อทดสอบ UI แบบออฟไลน์ */
export const USE_MOCK_DATA = false;

/** true = ล็อกอินแบบจำลอง (กรอกอะไรก็ผ่าน) ใช้ตอนทดสอบ UI โดยไม่ต่อ auth service */
export const USE_MOCK_AUTH = false;

/**
 * กันไม่ให้ release build ออกไปพร้อม mock ที่เปิดค้างไว้
 * mock auth ทำให้ใครก็เข้าแอปได้ ส่วน mock data ทำให้หน้างานเห็นข้อมูลปลอมแล้วเข้าใจว่าจริง
 * ให้แอปล้มตั้งแต่เปิด คนทดสอบก่อนแจกจะเห็นทันที ดีกว่าหลุดไปถึงมือลีดเดอร์
 */
if (!__DEV__ && (USE_MOCK_AUTH || USE_MOCK_DATA)) {
  throw new Error('USE_MOCK_AUTH/USE_MOCK_DATA ต้องเป็น false ใน release build (src/api/config.ts)');
}

export const AUTH_ENDPOINTS = {
  /** POST { email, password } */
  login: '/api/v1/Auth/Login',
};

/**
 * ส่ง FCM token ไปเก็บที่ notify-server ด้วย (สำรองกรณีเขียน Firestore ไม่สำเร็จ)
 * ตั้ง false เมื่อไม่ได้รัน notify-server เพื่อไม่ให้แอปยิงหา server ที่ไม่มีทุกครั้งที่เปิด
 */
export const PUSH_TOKEN_REGISTRATION_ENABLED = true;

/**
 * บริการแจ้งเตือนแยกต่างหาก (notify-server) ไม่ใช่ backend หลัก
 * อยู่ใน LAN โรงงานเท่านั้น ห้ามเปิดออกอินเทอร์เน็ต (ดู notify-server/README.md)
 * push ยังถึงมือถือนอกโรงงานได้เพราะวิ่งผ่าน FCM ส่วนรูปแนบใช้ได้เฉพาะตอนต่อ WiFi โรงงาน
 */
export const NOTIFY_SERVER_URL = 'http://192.168.2.222:8090';

export const ENDPOINTS = {
  /** GET รายการ idle time — query: dateFrom, dateTo, cdEquip */
  records: '/api/v1/IdleTime/GetLineIdleTimeDtoAsync',
  /** PUT แก้ไขรายการ — body เป็น array ของ record เต็ม */
  updateRecords: '/api/v1/IdleTime/PutLineIdleTimeAsync',
  /** POST { token, platform, userName } — backend เก็บ token ไว้ใช้ยิง push (ยังต้องสร้างฝั่ง server) */
  registerPushToken: '/api/v1/Notification/RegisterDevice',
  /** POST { token } — notify-server เลิกส่งแจ้งเตือนมาเครื่องนี้ ใช้ตอนออกจากระบบ */
  unregisterPushToken: '/api/v1/Notification/UnregisterDevice',
  /** POST สร้างรายการเพิ่มเอง — body เป็น record เดี่ยว */
  createRecord: '/api/v1/IdleTime/PostLineIdleTimeManualAsync',
};

/** API ของ Idle Time ไม่ต้องแนบ token (เว็บก็ยิงตรงโดยไม่มี header auth) */
export const IDLE_TIME_API_REQUIRES_TOKEN = false;

/** แปลงชื่อไลน์ที่ใช้ใน UI ("ALL" | "Line1" | "Line2") เป็นค่า cdEquip ที่ API ต้องการ */
export function toCdEquip(line?: string) {
  if (!line || line === 'ALL') return 'ALL';
  return line.toLowerCase(); // Line1 -> line1
}

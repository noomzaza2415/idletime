import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { connect } from 'node:http2';

/**
 * ส่งแจ้งเตือนเข้า iPhone ผ่าน APNs ของ Apple โดยตรง
 *
 * ต้องมีตัวนี้เพราะแอปขอ token ด้วย getDevicePushTokenAsync ซึ่งบน iPhone ได้ APNs token
 * ไม่ใช่ FCM token ถ้าส่งเข้า FCM จะโดนปฏิเสธว่า token ใช้ไม่ได้ แล้วเครื่องถูกปิดทิ้งเงียบ ๆ
 *
 * เลือกส่งจาก server แทนการลง Firebase SDK ในแอป เพราะ SDK เป็น native module ที่ต้อง build
 * Android ใหม่ และชนกับตัวรับ FCM ของ expo-notifications ได้ ฝั่ง Android ที่ใช้งานจริงอยู่จึงไม่ถูกแตะ
 */

export const APNS_PRODUCTION_ORIGIN = 'https://api.push.apple.com';
export const APNS_SANDBOX_ORIGIN = 'https://api.sandbox.push.apple.com';

/**
 * Apple ให้ใช้ token ยืนยันตัวตนตัวเดิมได้ไม่เกิน 1 ชั่วโมง และห้ามสร้างใหม่ถี่กว่า 20 นาที
 * ไม่งั้นตอบ TooManyProviderTokenUpdates จึงต่ออายุทุก 50 นาที
 */
const AUTH_TOKEN_TTL_MS = 50 * 60_000;

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * ตัดสินว่า token ตายจากรหัส 410 อย่างเดียว ซึ่ง Apple ใช้บอกว่าเครื่องถอนแอปหรือ token หมดอายุ
 *
 * ห้ามนับ BadDeviceToken หรือ DeviceTokenNotForTopic เป็น token ตาย เพราะสองตัวนี้เกิดจาก
 * ตั้งค่า server ผิดได้ด้วย (APNS_PRODUCTION ไม่ตรงกับแบบ build หรือ bundle id ผิด)
 * ซึ่งจะตอบกลับมาทุกเครื่อง แล้ว iPhone ทั้งโรงงานถูกปิดแจ้งเตือนพร้อมกันเงียบ ๆ
 */
const DEAD_TOKEN_STATUS = 410;

/**
 * แยกเครื่องตามช่องทางส่ง และตัด token ซ้ำ (เครื่องเดียวอาจลงทะเบียนไว้ทั้งไฟล์และ Firestore)
 *
 * ทุกอย่างที่ไม่ใช่ "ios" ไปทาง FCM เหมือนเดิม รวมถึงแถวเก่าที่ไม่มี platform
 * เพื่อให้เครื่อง Android ที่ใช้งานอยู่ได้รับแจ้งเตือนแบบเดิมทุกประการ
 *
 * @param {{token: string, platform?: string}[]} devices
 * @returns {{fcm: string[], apns: string[]}}
 */
export function splitDevices(devices) {
  const fcm = new Set();
  const apns = new Set();
  for (const { token, platform } of devices) {
    if (!token) continue;
    (platform === 'ios' ? apns : fcm).add(token);
  }
  return { fcm: [...fcm], apns: [...apns] };
}

export class ApnsSender {
  /**
   * @param {object} options
   * @param {string} options.keyFile ไฟล์ .p8 ที่สร้างจาก Apple Developer (Keys)
   * @param {string} options.keyId Key ID ของไฟล์นั้น
   * @param {string} options.teamId Team ID ของบัญชี Apple Developer
   * @param {string} options.bundleId bundle identifier ของแอป ต้องตรงกับ app.json
   * @param {string} options.origin ปลายทาง APNs (production หรือ sandbox)
   */
  constructor({ keyFile, keyId, teamId, bundleId, origin }) {
    this.privateKey = createPrivateKey(readFileSync(keyFile, 'utf8'));
    this.keyId = keyId;
    this.teamId = teamId;
    this.bundleId = bundleId;
    this.origin = origin;
    /** @type {{value: string, createdAt: number} | null} */
    this.authToken = null;
    /** @type {import('node:http2').ClientHttp2Session | null} */
    this.session = null;
  }

  /** JWT แบบ ES256 ตามที่ APNs กำหนด ใช้ซ้ำจนกว่าจะครบอายุ */
  #bearer() {
    const now = Date.now();
    if (this.authToken && now - this.authToken.createdAt < AUTH_TOKEN_TTL_MS) {
      return this.authToken.value;
    }

    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'ES256', kid: this.keyId })}.${encode({
      iss: this.teamId,
      iat: Math.floor(now / 1000),
    })}`;
    const signature = sign('sha256', Buffer.from(unsigned), {
      key: this.privateKey,
      dsaEncoding: 'ieee-p1363',
    }).toString('base64url');

    this.authToken = { value: `${unsigned}.${signature}`, createdAt: now };
    return this.authToken.value;
  }

  /** เปิด HTTP/2 ค้างไว้ใช้ซ้ำ ถ้าหลุดหรือ Apple สั่งปิด รอบหน้าค่อยเปิดใหม่ */
  #connection() {
    if (this.session && !this.session.closed && !this.session.destroyed) return this.session;

    const session = connect(this.origin);
    const drop = () => {
      if (this.session === session) this.session = null;
    };
    session.on('error', drop);
    session.on('goaway', drop);
    session.on('close', drop);
    // ไม่ให้ session ที่ว่างอยู่ค้าง process ไว้ตอนปิดบริการ
    session.unref();
    this.session = session;
    return session;
  }

  /** @returns {Promise<{status: number, reason: string | null}>} */
  #post(token, payload) {
    return new Promise((resolve, reject) => {
      const req = this.#connection().request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${this.#bearer()}`,
        'apns-topic': this.bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
      });

      let status = 0;
      let raw = '';
      req.setEncoding('utf8');
      req.setTimeout(REQUEST_TIMEOUT_MS, () => req.close());
      req.on('response', (headers) => {
        status = Number(headers[':status']);
      });
      req.on('data', (chunk) => {
        raw += chunk;
      });
      // ใช้ close แทน end เพราะถ้าหมดเวลาแล้วถูกปิดกลางทาง end จะไม่เกิด แต่ close เกิดเสมอ
      req.on('close', () => {
        let reason = null;
        try {
          reason = raw ? JSON.parse(raw).reason ?? null : null;
        } catch {
          // บางครั้งไม่มีเนื้อความกลับมา ใช้แค่ status ก็พอ
        }
        resolve({ status, reason: status === 0 ? 'Timeout' : reason });
      });
      req.on('error', reject);
      req.end(payload);
    });
  }

  /**
   * ส่งแจ้งเตือนไปทุกเครื่องที่ระบุ รูปแบบผลลัพธ์เหมือน FcmSender.send
   *
   * @param {string[]} tokens
   * @param {{title: string, body: string, target?: {recordId?: string, date?: string}}} message
   * @returns {Promise<{sent: number, failed: number, deadTokens: string[]}>}
   */
  async send(tokens, { title, body, target }) {
    if (tokens.length === 0) return { sent: 0, failed: 0, deadTokens: [] };

    const data = {};
    if (target?.recordId) data.recordId = String(target.recordId);
    if (target?.date) data.date = String(target.date);

    // expo-notifications บน iOS อ่าน content.data ของแจ้งเตือนจาก server จากคีย์ "body"
    // ข้าง aps (ดู NotificationRecords.swift) ถ้าวางที่อื่น กดแจ้งเตือนแล้วจะไม่เปิดรายการนั้น
    const payload = JSON.stringify({
      aps: { alert: { title, body }, sound: 'default' },
      body: data,
    });

    const results = await Promise.allSettled(tokens.map((token) => this.#post(token, payload)));

    let sent = 0;
    let failed = 0;
    const deadTokens = [];
    const reasons = new Map();

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.status === 200) {
        sent += 1;
        return;
      }
      failed += 1;
      if (result.status === 'fulfilled' && result.value.status === DEAD_TOKEN_STATUS) {
        deadTokens.push(tokens[index]);
      }
      const reason =
        result.status === 'fulfilled'
          ? `${result.value.status} ${result.value.reason ?? ''}`.trim()
          : result.reason?.message ?? String(result.reason);
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    });

    // รวมเหตุผลไว้บรรทัดเดียว ถ้าตั้งค่าผิดจะเห็นทันทีว่าทุกเครื่องล้มด้วยเหตุเดียวกัน
    if (reasons.size > 0) {
      const summary = [...reasons].map(([reason, count]) => `${reason} x${count}`).join(', ');
      console.error(`APNs ส่งไม่สำเร็จ: ${summary}`);
    }

    return { sent, failed, deadTokens };
  }

  close() {
    this.session?.close();
    this.session = null;
  }
}

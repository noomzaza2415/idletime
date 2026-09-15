import { readFileSync } from 'node:fs';

import admin from 'firebase-admin';

/** FCM รับได้ไม่เกิน 500 token ต่อหนึ่ง request */
const BATCH_SIZE = 500;

/**
 * รหัส error ที่แปลว่า token ใช้ไม่ได้ถาวร ต้องเลิกส่งไปเครื่องนั้น
 * ถ้าไม่ตัดออก token ตายจะค้างสะสมจน log เต็มไปด้วย error และเปลืองโควตา
 *
 * ห้ามใส่ messaging/invalid-argument เพราะ error นี้เกิดจาก payload ผิดรูปแบบก็ได้
 * ซึ่งจะตอบกลับมาทุก token ในรอบนั้น แล้วเครื่องทั้งโรงงานถูกปิดแจ้งเตือนพร้อมกันเงียบ ๆ
 */
const DEAD_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/** ช่องแจ้งเตือนฝั่ง Android — ต้องตรงกับที่แอปสร้างไว้ ไม่งั้นจะไม่ได้เสียงและ importance ที่ตั้งไว้ */
const ANDROID_CHANNEL_ID = 'idle-time-alerts';

export class FcmSender {
  /** @param {string} serviceAccountPath ไฟล์ service account key จาก Firebase Console */
  constructor(serviceAccountPath) {
    const credentials = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    this.app = admin.initializeApp({
      credential: admin.credential.cert(credentials),
    });
    this.projectId = credentials.project_id;
  }

  /**
   * ส่งแจ้งเตือนไปทุกเครื่องที่ระบุ
   *
   * ยิงรอบเดียวต่อหนึ่งเหตุการณ์ ไม่มีการเตือนซ้ำ
   * server จึงไม่ต้องจำสถานะว่าเคยส่งอะไรไปแล้ว
   *
   * @param {string[]} tokens
   * @param {{title: string, body: string, target?: {recordId?: string, date?: string}}} message
   * @returns {Promise<{sent: number, failed: number, deadTokens: string[]}>}
   */
  async send(tokens, { title, body, target }) {
    if (tokens.length === 0) return { sent: 0, failed: 0, deadTokens: [] };

    // FCM data ต้องเป็น string ทุกค่า ตัวเลข/undefined จะโดนปฏิเสธทั้ง request
    const data = {};
    if (target?.recordId) data.recordId = String(target.recordId);
    if (target?.date) data.date = String(target.date);

    let sent = 0;
    let failed = 0;
    const deadTokens = [];

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);

      const response = await admin.messaging(this.app).sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId: ANDROID_CHANNEL_ID,
            sound: 'default',
          },
        },
        apns: {
          payload: { aps: { sound: 'default' } },
        },
      });

      sent += response.successCount;
      failed += response.failureCount;

      response.responses.forEach((result, index) => {
        if (result.success) return;
        const code = result.error?.code;
        if (DEAD_TOKEN_ERRORS.has(code)) deadTokens.push(batch[index]);
      });
    }

    return { sent, failed, deadTokens };
  }
}

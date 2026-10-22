/**
 * error กลางของแอป แยก "เกิดอะไรขึ้น" ออกจาก "จะบอกผู้ใช้ว่าอะไร"
 *
 * ชั้น network และ service โยน AppError พร้อมรหัสและรายละเอียดทางเทคนิค
 * หน้าจอเรียก describeError แปลงเป็นข้อความที่บอกสาเหตุเป็นภาษาคน บอกว่าต้องทำอะไรต่อ
 * และแนบข้อมูลสำหรับแจ้ง IT ไว้ท้ายข้อความ ถ่ายหน้าจอส่งมาแล้วรู้ทันทีว่าพังที่ขั้นไหน
 *
 * ไฟล์นี้ไม่มี import ของ React Native ทดสอบด้วย node ได้ตรง ๆ
 */
import type { TranslationKey } from '@/constants/i18n';

export type ErrorCode =
  /** ต่อเครือข่ายไม่ได้เลย (ไม่มี wifi, ต่อ server ไม่ติด) */
  | 'OFFLINE'
  /** ต่อได้แต่ server ไม่ตอบภายในเวลาที่กำหนด */
  | 'TIMEOUT'
  /** server ตอบ HTTP status ที่ไม่ใช่ 2xx */
  | 'HTTP'
  /** server ตอบ 2xx แต่บอกว่าไม่สำเร็จ (isSuccess = false) */
  | 'REJECTED'
  /** server ตอบกลับมาแต่อ่านไม่ได้ เช่นไม่ใช่ JSON */
  | 'BAD_RESPONSE'
  /** รายการที่จะทำงานด้วยไม่อยู่ในระบบแล้ว */
  | 'RECORD_GONE';

export interface AppErrorInfo {
  status?: number;
  /** ข้อความที่ server ส่งกลับมาตรง ๆ ใช้ช่วย IT หาสาเหตุ */
  serverMessage?: string;
  /** "PUT 192.168.2.5:5053/api/v1/IdleTime/PutLineIdleTimeAsync" บอกว่าพังที่ server และขั้นไหน */
  endpoint?: string;
  /** เวลาที่รอก่อนตัด ใช้กับ TIMEOUT */
  timeoutMs?: number;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly info: AppErrorInfo;
  readonly at: Date;

  constructor(code: ErrorCode, info: AppErrorInfo = {}) {
    // message เป็นสรุปทางเทคนิค ที่ไหนยังอ่าน e.message ตรง ๆ ก็ยังได้ข้อมูลที่มีประโยชน์
    super(
      [code, info.status, info.endpoint, info.serverMessage].filter((v) => v !== undefined).join(' · ')
    );
    this.name = 'AppError';
    this.code = code;
    this.info = info;
    this.at = new Date();
  }
}

/** ข้อความจาก server อาจเป็นหน้า HTML ยาวทั้งหน้า ตัดให้พอดีกล่องแจ้งเตือน */
const SERVER_MESSAGE_MAX = 200;

/** "GET http://192.168.2.5:5053/api/x?date=..." -> "GET 192.168.2.5:5053/api/x" ไม่ต้องอ่าน query ยาว ๆ */
export function describeEndpoint(method: string, url: string) {
  const noQuery = url.split('?')[0];
  return `${method.toUpperCase()} ${noQuery.replace(/^https?:\/\//, '')}`;
}

type Translate = (key: TranslationKey) => string;

/** เลือกสาเหตุและวิธีแก้ตามชนิดของ error และ HTTP status */
function reasonKeys(e: AppError): { reason: TranslationKey; action: TranslationKey } {
  switch (e.code) {
    case 'OFFLINE':
      return { reason: 'errReasonOffline', action: 'errActionOffline' };
    case 'TIMEOUT':
      return { reason: 'errReasonTimeout', action: 'errActionRetryThenIt' };
    case 'REJECTED':
      return { reason: 'errReasonRejected', action: 'errActionCheckMessage' };
    case 'BAD_RESPONSE':
      return { reason: 'errReasonBadResponse', action: 'errActionReportIt' };
    case 'RECORD_GONE':
      return { reason: 'errReasonRecordGone', action: 'errActionReloadList' };
    case 'HTTP': {
      const s = e.info.status ?? 0;
      if (s === 401 || s === 403) return { reason: 'errReasonAuth', action: 'errActionRelogin' };
      if (s === 404) return { reason: 'errReasonNotFound', action: 'errActionReportIt' };
      if (s === 400 || s === 409 || s === 422) {
        return { reason: 'errReasonBadRequest', action: 'errActionReportIt' };
      }
      if (s >= 500) return { reason: 'errReasonServer', action: 'errActionRetryThenIt' };
      return { reason: 'errReasonHttpOther', action: 'errActionReportIt' };
    }
  }
}

function hhmmss(d: Date) {
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}

/**
 * ข้อความสำหรับแสดงในกล่องแจ้งเตือน ใช้คู่กับหัวข้อที่บอกว่าทำอะไรไม่สำเร็จ เช่น "บันทึกไม่สำเร็จ"
 *
 *   เนื่องจาก <สาเหตุ>
 *   <ต้องทำอะไรต่อ>
 *
 *   ข้อมูลสำหรับแจ้ง IT
 *   รหัส: HTTP 500
 *   ปลายทาง: PUT 192.168.2.5:5053/...
 *   ข้อความจาก server: ...
 *   เวลา: 14:40:12
 */
export function describeError(err: unknown, t: Translate): string {
  if (!(err instanceof AppError)) {
    // error ที่ไม่ได้มาจากชั้น network ส่วนใหญ่เป็นบั๊กในแอป เก็บข้อความเดิมไว้ให้ IT
    const raw = err instanceof Error ? err.message : String(err);
    return [
      `${t('errBecause')}${t('errReasonUnknown')}`,
      t('errActionReportIt'),
      '',
      t('errItHeader'),
      `${t('errDetailMessage')}: ${raw}`,
      `${t('errDetailTime')}: ${hhmmss(new Date())}`,
    ].join('\n');
  }

  const { reason, action } = reasonKeys(err);
  let reasonText = t(reason);
  if (err.code === 'TIMEOUT') {
    reasonText = reasonText.replace('{sec}', String(Math.round((err.info.timeoutMs ?? 0) / 1000)));
  }

  const serverMessage = err.info.serverMessage?.trim();
  const shortServer =
    serverMessage && serverMessage.length > SERVER_MESSAGE_MAX
      ? `${serverMessage.slice(0, SERVER_MESSAGE_MAX)}…`
      : serverMessage;

  const lines = [`${t('errBecause')}${reasonText}`];
  // ระบบปฏิเสธพร้อมเหตุผล ให้ผู้ใช้เห็นเหตุผลนั้นตรงนี้เลย ไม่ต้องไปอ่านในส่วนของ IT
  if (err.code === 'REJECTED' && shortServer) lines.push(`"${shortServer}"`);
  lines.push(t(action), '', t('errItHeader'));
  lines.push(`${t('errDetailCode')}: ${err.code}${err.info.status ? ` ${err.info.status}` : ''}`);
  if (err.info.endpoint) lines.push(`${t('errDetailEndpoint')}: ${err.info.endpoint}`);
  if (shortServer && err.code !== 'REJECTED') {
    lines.push(`${t('errDetailMessage')}: ${shortServer}`);
  }
  lines.push(`${t('errDetailTime')}: ${hhmmss(err.at)}`);
  return lines.join('\n');
}

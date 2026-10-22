/**
 * ตัวห่อ fetch สำหรับงานหน้าโรงงาน
 *
 * เครือข่ายในโรงงานหลุดเป็นช่วง ๆ ได้ตลอด และ fetch ของ React Native ไม่มี timeout
 * ในตัว ถ้าไม่ตัดเวลาเอง request ที่ไปไม่ถึงปลายทางจะค้างไว้เฉย ๆ หน้าจอหมุนไม่จบ
 * ผู้ใช้หน้างานจะไม่รู้ว่าควรยืนรอหรือกดใหม่ ซึ่งเสียเวลาหน้าไลน์โดยตรง
 */

import { AppError, describeEndpoint } from '@/api/app-error';

/** เวลารอสูงสุดต่อหนึ่ง request เผื่อ wifi โรงงานช้าแต่ไม่ถึงกับตัดขาด */
export const NETWORK_TIMEOUT_MS = 15_000;

/** จำนวนครั้งที่ยอมลองซ้ำสำหรับคำสั่งอ่านข้อมูล นับรวมครั้งแรกด้วย */
const READ_ATTEMPTS = 2;

/** หน่วงก่อนลองซ้ำ สั้น ๆ พอให้สัญญาณที่สะดุดชั่วขณะกลับมา */
const RETRY_DELAY_MS = 800;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ยิง request หนึ่งครั้งพร้อมตัดเวลา
 *
 * แยก timeout กับต่อไม่ติดออกจากกัน เพราะสองกรณีนี้ผู้ใช้ต้องทำคนละอย่าง
 * ต่อไม่ติดคือต้องไปดู wifi ส่วนช้าเกินไปคือรอสักครู่แล้วกดใหม่ก็มักจะผ่าน
 * แนบปลายทางไปกับ error ด้วย IT จะรู้ว่า server ตัวไหนและขั้นไหนที่มีปัญหา
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = NETWORK_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch {
    // ข้อความจาก fetch เป็นภาษาอังกฤษเชิงเทคนิค ไม่ช่วยคนหน้างาน หน้าจอจะแปลงรหัสนี้เป็นข้อความที่บอกว่าต้องทำอะไรต่อ
    throw new AppError(controller.signal.aborted ? 'TIMEOUT' : 'OFFLINE', {
      endpoint: describeEndpoint(options.method ?? 'GET', url),
      timeoutMs,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * ยิง request ที่อ่านข้อมูลอย่างเดียว พร้อมลองซ้ำเมื่อสัญญาณสะดุด
 *
 * ใช้เฉพาะคำสั่งอ่าน เพราะเรียกซ้ำแล้วผลลัพธ์เหมือนเดิม ไม่เกิดข้อมูลซ้ำ
 * ห้ามเอาไปใช้กับคำสั่งบันทึกหรือลบ เพราะการลองซ้ำอาจทำงานสองรอบโดยที่ผู้ใช้ไม่รู้
 */
export async function fetchRead(
  url: string,
  options: RequestInit = {},
  timeoutMs = NETWORK_TIMEOUT_MS
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt++) {
    try {
      return await fetchWithTimeout(url, options, timeoutMs);
    } catch (err) {
      lastError = err;
      if (attempt < READ_ATTEMPTS) await delay(RETRY_DELAY_MS);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new AppError('OFFLINE', { endpoint: describeEndpoint(options.method ?? 'GET', url) });
}

import type { BreakRuleType } from '@/api/idle-rules';

// โครงสร้างข้อมูล 1 รายการ idle time (1 แถวในตารางเว็บต้นฉบับ)
export interface IdleTimeRecord {
  id: string; // ID รายการ (ใช้ต่อ backend จริง)
  no: number; // ลำดับที่แสดง
  date: string; // "2026-09-04"
  line: string; // "Line1" | "Line2" | ...
  item: string; // ชื่อ item เช่น "Line1"
  workOrder: string; // 6JMGF02J
  modelSuffix: string; // T13X2EHHTXA.ANBEECD
  lotSize: number;

  idleTimeIssue: string; // สาเหตุการหยุด (จากลิสต์/พิมพ์เอง)
  action: string; // การแก้ไข

  startTime: string; // "13:37"
  endTime: string; // "13:37"
  totalMins: number; // นาทีที่หยุด

  stopPoint: string; // "Line Stop"
  vendor: boolean; // ต้องรอ vendor หรือไม่
  dj: boolean; // ต้องรอ DJ หรือไม่
  manPower: string;
  type: string; // ประเภทของสาเหตุ
  judge: string; // ผลตัดสิน Accept/Delete (judgeWork)
  reason: string; // เหตุผลประกอบ แยกจากสาเหตุการหยุด (reason)
  dept: string; // แผนกที่รับผิดชอบ หรือชื่อ vendor เมื่อต้องรอ vendor
  remark: string;
  /** สถานะไลน์จากเครื่องจักร เช่น RUNNING, REWORK แสดงอย่างเดียว */
  status: string;

  isBreakTime?: boolean; // true = ช่วงพักเบรก ไม่นับ idle จริง
  /**
   * ผลของกติกาช่วงพัก — 'SHOW_BUTTON' คือคาบเกี่ยวเวลาพักแบบที่ระบบตัดสินแทนไม่ได้
   * หน้ากรอกสาเหตุจะขึ้นปุ่มให้พนักงานเลือกเองว่าเป็น Break Time หรือไม่
   * ('HIDDEN' ไม่มีทางมาถึงหน้าจอ เพราะถูกกรองทิ้งตั้งแต่ชั้นดึงข้อมูล)
   */
  breakRuleType?: BreakRuleType | null;
  photoUrl?: string | null; // รูปประกอบ (ถ้ามีจากขั้นตอนถ่ายรูปหน้างาน)
  updatedAt?: string;
  updatedBy?: string;
}

/**
 * รูปแบบดิบที่ backend ส่งกลับมา (GetLineIdleTimeDtoAsync)
 * ชื่อ field ไม่ตรงกับ IdleTimeRecord ที่หน้าจอใช้ จึงมีชั้นแปลงใน idle-time-service.ts
 */
export interface ApiIdleTimeRecord {
  id: number;
  dateTime: string;
  lineName: string;
  status: string | null;
  totalCounter: number | null;
  totalIdleTime: number | null;
  lineStop: number | null;
  rework: number | null;
  timestartOff: string | null;
  timestartOn: string | null;
  /** วินาที */
  totaltimeOff: number | null;
  /** นาที */
  totaltimeoffMins: number | null;
  workOrder: string | null;
  modelSuffix: string | null;
  lotSize: number | null;
  idletimeIss: string | null;
  actionDes: string | null;
  venDorTime: number | null;
  djTime: number | null;
  idleTime: number | null;
  manPower: number | null;
  manHour: number | null;
  amountThb: number | null;
  typeWork: string | null;
  judgeWork: string | null;
  reason: string | null;
  dept: string | null;
  remark: string | null;
  station: string | number | null;
  lineType1: string | null;
  lineType2: string | null;
  lineType3: string | null;
  lineType4: string | null;
}

/** ผลลัพธ์ตอนล็อกอินสำเร็จ */
export interface AuthLoginResult {
  status: string;
  message: string;
  token: string;
  expiration: string;
}

/**
 * ซอง response ของ auth service
 * ตอนสำเร็จ result เป็น object แต่ตอนล้มเหลวจะกลายเป็น string ข้อความ error
 */
export interface AuthEnvelope {
  statusCode: number;
  isSuccess: boolean;
  email: string | null;
  errorMessages: string[];
  result: AuthLoginResult | string;
}

/** ซอง response มาตรฐานของ backend */
export interface ApiEnvelope<T> {
  statusCode: number;
  isSuccess: boolean;
  errorMessages: string[];
  result: T;
}

// ตัวเลือกสาเหตุมาตรฐาน — แก้ไข/โหลดจาก API จริงได้ภายหลัง
export const IDLE_ISSUE_OPTIONS = [
  'รอวัตถุดิบ',
  'เครื่องเสีย',
  'รอปรับตั้งเครื่อง (Setup)',
  'รอ QC ตรวจสอบ',
  'ขาดพนักงาน',
  'พักเบรก',
  'อื่นๆ',
];

/**
 * ข้อความที่เติมให้เมื่อกด Break Time — ต้องตรงกับฝั่งเว็บ ไม่งั้นรายงานจะนับคนละกลุ่ม
 * ใช้เป็นตัวชี้ขาดด้วยว่ารายการไหนคือช่วงพัก เพื่อให้แสดงเป็นสีเหลืองแทนสีเขียว
 */
export const BREAK_TIME_VALUE = 'Break Time';

/*
  ตัวเลือกทั้งหมดคัดลอกจากหน้า dashboard ของเว็บ ต้องตรงกันทุกตัวและเรียงเหมือนกัน
  ถ้าแอปใช้ชื่อที่เว็บไม่รู้จัก รายงานฝั่งเว็บจะจัดกลุ่มไม่ตรง และช่องบนเว็บจะแสดงเป็นว่าง
*/

export const TYPE_OPTIONS = [
  'Equipment',
  'Other',
  'Quality',
  'Rework',
  'Shortage',
  'Delivery',
  'Process',
  'Model change',
  'Seowon',
];

export const JUDGE_OPTIONS = ['Accept', 'Delete'];

/** แผนกในโรงงาน ใช้เมื่อไม่ได้รอ vendor */
export const DEPT_OPTIONS = [
  'Production',
  'RD',
  'Vibration',
  'INJ',
  'Set line',
  'Purchase',
  'Sealant',
  'Sale',
  'Line',
  'Store',
  'PE',
  'QC',
];

/** รายชื่อ vendor ช่อง Dept เปลี่ยนมาใช้รายการนี้เมื่อติ๊ก "ต้องรอ Vendor" เหมือนเว็บ */
export const VENDOR_OPTIONS = [
  'Daeji',
  'Haeng Sung',
  'Sung Eun',
  'TFL',
  'Dae - A',
  'Shin Ho Thai',
  'LG',
  'Fine Web Tech',
  'Han Yang',
  'PSM',
  'Moon Sung',
  'RDP',
  'Thai Sung Su',
  'Kotec',
  'Taejin',
  'Ching Cheng',
];

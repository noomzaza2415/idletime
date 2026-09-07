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
  dept: string; // แผนกที่รับผิดชอบ
  remark: string;

  isBreakTime?: boolean; // true = ช่วงพักเบรก ไม่นับ idle จริง
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

export const DEPT_OPTIONS = ['Production', 'Maintenance', 'QC', 'Warehouse', 'Engineering'];

export const TYPE_OPTIONS = ['Machine', 'Man', 'Material', 'Method', 'Other'];

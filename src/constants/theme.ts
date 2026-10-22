/**
 * Design tokens ของแอป Idle Time Tracker
 * มี 2 ชุดสี — โหมดมืดเป็นค่าเริ่มต้น (ใช้งานในโรงงานที่แสงน้อย/กะกลางคืน)
 * ชุดสีสว่างอ้างอิงโทนจากเว็บต้นฉบับ (หัวข้อ/ปุ่มน้ำเงิน, Total Mins แดง)
 */

import '@/global.css';

const light = {
  bg: '#F3F4F6',
  surface: '#FFFFFF',
  primary: '#1D4ED8',
  primaryDark: '#1E3A8A',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  success: '#16A34A',
  warning: '#EA580C',
  /** slate-300 — เดิม #E5E7EB ต่างจากพื้นแค่ 1.2:1 ขอบช่องกรอกหายไปใต้แสงจ้าหน้าไลน์ */
  border: '#CBD5E1',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  chipBg: '#EFF6FF',
  /** ขอบกล่องข้อมูลที่ระบบคำนวณให้ (Man Hour/Amount) พื้น chipBg อย่างเดียวกลืนกับพื้นจอ */
  infoBoxBorder: '#BFDBFE',
  badgeDoneBg: '#DCFCE7',
  badgePendingBg: '#FEF3C7',
  /** พื้นการ์ดบอกสถานะ — จางกว่า dangerBg/badgeDoneBg เพื่อไม่ให้แย่งสายตาจากตัวหนังสือ */
  cardPendingBg: '#FEF2F2',
  /** ข้อความรองบนพื้นการ์ดที่มีสี — เข้มกว่า textSecondary เพื่อให้ผ่านเกณฑ์ contrast 4.5:1 */
  textSecondaryStrong: '#4B5563',
  /** พื้น badge ใช้สีสถานะทึบ เพราะพื้น badge เดิมกลืนกับพื้นการ์ด (1.02:1) */
  /** เส้นใต้ช่องค้นหาตอนโฟกัส — สีจากดีไซน์ต้นฉบับ ใช้ได้ดีบนพื้นขาว (7.81:1) */
  focusAccent: '#2F2EE9',
  statusPendingFill: '#DC2626',
  statusDoneFill: '#15803D',
  /** ช่วงพัก — เหลืองอำพัน เข้มพอให้อ่านตัวหนังสือขาวบนพื้นนี้ได้ */
  statusBreakFill: '#A16207',
  breakAccent: '#CA8A04',
  breakBg: '#FEFCE8',
  onStatus: '#FFFFFF',
  onPrimary: '#FFFFFF',
  /**
   * ป้ายสถานะไลน์จากเครื่องจักร (ช่อง Status) — สีเดียวกับตารางบนเว็บ
   * RUNNING = emerald, REWORK = orange (Tailwind 100/700/200)
   */
  machineRunningBg: '#D1FAE5',
  machineRunningText: '#047857',
  machineRunningBorder: '#A7F3D0',
  machineReworkBg: '#FFEDD5',
  machineReworkText: '#C2410C',
  machineReworkBorder: '#FED7AA',
};

/**
 * โทนมืดแบบกรมท่า: พื้นออกน้ำเงินและสว่างกว่าดำล้วน ให้อ่านง่ายขึ้นเมื่อดูนาน ๆ
 * สีน้ำเงิน/แดง/เขียว ถูกทำให้สว่างขึ้นเพื่อให้ contrast ผ่านบนพื้นเข้ม
 */
const dark: typeof light = {
  bg: '#141E33',
  surface: '#1D2A45',
  primary: '#60A5FA',
  primaryDark: '#3B82F6',
  danger: '#F87171',
  dangerBg: '#4A2433',
  success: '#4ADE80',
  warning: '#FBBF24',
  border: '#33466A',
  textPrimary: '#F3F4F6',
  /** สว่างกว่าเทามาตรฐาน (7.7:1 บนการ์ด) ให้ตัวเล็กอย่างเวลา/ป้ายแกน timeline อ่านง่ายสำหรับผู้ใช้สูงวัย */
  textSecondary: '#B4BFD2',
  /** ต้องให้ primary บนพื้นนี้ได้ ≥ 4.5:1 เพราะตัวอักษร TH/EN บนปุ่มภาษาใช้สีนี้ */
  chipBg: '#1E3462',
  infoBoxBorder: '#2C4A80',
  badgeDoneBg: '#183F37',
  badgePendingBg: '#45381C',
  cardPendingBg: '#33263A',
  textSecondaryStrong: '#CFD8E6',
  /** โหมดมืดใช้ primary แทน เพราะสีต้นฉบับเหลือ 2.21:1 ต่ำกว่าเกณฑ์ 3.0 ของ UI component */
  focusAccent: '#60A5FA',
  statusPendingFill: '#F87171',
  statusDoneFill: '#4ADE80',
  /** โหมดมืดใช้เหลืองสว่างขึ้น เพราะเหลืองเข้มจมไปกับพื้นการ์ด */
  statusBreakFill: '#FBBF24',
  breakAccent: '#FBBF24',
  breakBg: '#3D3520',
  onStatus: '#0F172A',
  onPrimary: '#0F172A',
  /** โหมดมืดของเว็บใช้พื้น 900 โปร่ง 40% — ผสมกับ surface ไว้ล่วงหน้าเป็นสีทึบ */
  machineRunningBg: '#143841',
  machineRunningText: '#34D399',
  machineRunningBorder: '#065F46',
  machineReworkBg: '#432B31',
  machineReworkText: '#FB923C',
  machineReworkBorder: '#9A3412',
};

export type ThemeMode = 'light' | 'dark';
export type ThemeColors = typeof light;

export const PALETTES: Record<ThemeMode, ThemeColors> = { light, dark };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** มุมโค้งขยายตามฟอนต์ที่ใหญ่ขึ้น ของเดิม (6/10/16) ดูคับเมื่อวางคู่ตัวอักษร 18 */
export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

/**
 * ความสูงขั้นต่ำของช่องกรอกและปุ่ม — 52 สูงกว่าเกณฑ์ touch target 48dp
 * เพราะผู้ใช้หลักเป็นพนักงานสูงวัยที่อาจสวมถุงมือในไลน์ผลิต
 */
export const controlHeight = 52;

/**
 * เงาสำหรับยกการ์ด/แผงให้ลอยจากพื้น ใช้ทั้ง iOS (shadow*) และ Android (elevation)
 * บนพื้นมืดเงาแทบมองไม่เห็น ซึ่งไม่เป็นไร เพราะโหมดมืดใช้เส้นขอบเป็นตัวแบ่งอยู่แล้ว
 */
export const elevation = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 12,
  },
} as const;

/**
 * ขนาดตัวอักษรตั้งไว้ใหญ่กว่าค่ามาตรฐาน เพราะผู้ใช้งานหลักเป็นพนักงานสูงวัยในไลน์ผลิต
 * body 18 อยู่เหนือเกณฑ์แนะนำขั้นต่ำ 16 สำหรับข้อความเนื้อหาบนมือถือ
 * และ small 15 ยังอ่านออกในระยะแขน ไม่ลงไปแตะ 12 ซึ่งเล็กเกินไปสำหรับสายตายาว
 */
/**
 * สเกลตัวอักษร
 *
 * ลดลงจากชุดเดิม (28/22/18/15) เพื่อให้เห็นรายการต่อหนึ่งหน้าจอได้มากขึ้น
 * ไม่ลดต่ำกว่านี้เพราะหน้างานอ่านผ่านๆ ในระยะแขน บางครั้งสวมแว่นนิรภัยที่มีฝ้า
 * ค่า body 16 เป็นขนาดมาตรฐานที่อ่านได้สบายบนมือถือ ส่วน small 13 ใช้กับข้อมูลรอง
 */
export const font = {
  h1: 24,
  h2: 19,
  body: 16,
  small: 13,
} as const;

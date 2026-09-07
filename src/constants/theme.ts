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
  border: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  chipBg: '#EFF6FF',
  badgeDoneBg: '#DCFCE7',
  badgePendingBg: '#FEF3C7',
  /** พื้นการ์ดบอกสถานะ — จางกว่า dangerBg/badgeDoneBg เพื่อไม่ให้แย่งสายตาจากตัวหนังสือ */
  cardPendingBg: '#FEF2F2',
  /** ข้อความรองบนพื้นการ์ดที่มีสี — เข้มกว่า textSecondary เพื่อให้ผ่านเกณฑ์ contrast 4.5:1 */
  textSecondaryStrong: '#4B5563',
  /** พื้น badge ใช้สีสถานะทึบ เพราะพื้น badge เดิมกลืนกับพื้นการ์ด (1.02:1) */
  statusPendingFill: '#DC2626',
  statusDoneFill: '#15803D',
  onStatus: '#FFFFFF',
  onPrimary: '#FFFFFF',
};

/** โทนมืด: สีน้ำเงิน/แดง/เขียว ถูกทำให้สว่างขึ้นเพื่อให้ contrast ผ่านบนพื้นเข้ม */
const dark: typeof light = {
  bg: '#0B0F17',
  surface: '#151B26',
  primary: '#60A5FA',
  primaryDark: '#3B82F6',
  danger: '#F87171',
  dangerBg: '#3F1D1D',
  success: '#4ADE80',
  warning: '#FBBF24',
  border: '#263041',
  textPrimary: '#F3F4F6',
  textSecondary: '#9CA3AF',
  chipBg: '#172554',
  badgeDoneBg: '#14321F',
  badgePendingBg: '#3A2C10',
  cardPendingBg: '#241A1E',
  textSecondaryStrong: '#C6CBD4',
  statusPendingFill: '#F87171',
  statusDoneFill: '#4ADE80',
  onStatus: '#0B0F17',
  onPrimary: '#0B0F17',
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
export const font = {
  h1: 28,
  h2: 22,
  body: 18,
  small: 15,
} as const;

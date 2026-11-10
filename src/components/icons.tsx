/**
 * ไอคอน Lucide (ISC license) วาดด้วย react-native-svg ใช้บนแถบเลือกวัน/ไลน์และการ์ดสรุปหน้ากราฟเต็มจอ
 * ไม่ใช้ตัวอักษร ◀ ▶ ▼ เพราะบาง Android ไม่มี glyph หรือวาดขนาดไม่เท่ากัน
 */
import type { ReactNode } from 'react';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
  strokeWidth?: number;
}

function LucideIcon({
  color,
  size = 20,
  strokeWidth = 2,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      {children}
    </Svg>
  );
}

/** ย้อนกลับวัน */
export function ChevronLeftIcon(p: IconProps) {
  return (
    <LucideIcon {...p}>
      <Path d="m15 18-6-6 6-6" />
    </LucideIcon>
  );
}

/** ไปวันถัดไป */
export function ChevronRightIcon(p: IconProps) {
  return (
    <LucideIcon {...p}>
      <Path d="m9 18 6-6-6-6" />
    </LucideIcon>
  );
}

/** dropdown */
export function ChevronDownIcon(p: IconProps) {
  return (
    <LucideIcon {...p}>
      <Path d="m6 9 6 6 6-6" />
    </LucideIcon>
  );
}

/** วันนี้ */
export function CalendarCheckIcon(p: IconProps) {
  return (
    <LucideIcon {...p}>
      <Path d="M8 2v4" />
      <Path d="M16 2v4" />
      <Rect width={18} height={18} x={3} y={4} rx={2} />
      <Path d="M3 10h18" />
      <Path d="m9 16 2 2 4-4" />
    </LucideIcon>
  );
}

/** เลือกวันที่ */
export function CalendarDaysIcon(p: IconProps) {
  return (
    <LucideIcon {...p}>
      <Path d="M8 2v4" />
      <Path d="M16 2v4" />
      <Rect width={18} height={18} x={3} y={4} rx={2} />
      <Path d="M3 10h18" />
      <Path d="M8 14h.01" />
      <Path d="M12 14h.01" />
      <Path d="M16 14h.01" />
      <Path d="M8 18h.01" />
      <Path d="M12 18h.01" />
      <Path d="M16 18h.01" />
    </LucideIcon>
  );
}

/** เลือก LINE */
export function FactoryIcon(p: IconProps) {
  return (
    <LucideIcon {...p}>
      <Path d="M12 16h.01" />
      <Path d="M16 16h.01" />
      <Path d="M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" />
      <Path d="M8 16h.01" />
    </LucideIcon>
  );
}

/** สถานะเดินงาน */
export function CirclePlayIcon(p: IconProps) {
  return (
    <LucideIcon {...p}>
      <Circle cx={12} cy={12} r={10} />
      <Polygon points="10 8 16 12 10 16 10 8" />
    </LucideIcon>
  );
}

/** สถานะหยุด */
export function CircleStopIcon(p: IconProps) {
  return (
    <LucideIcon {...p}>
      <Circle cx={12} cy={12} r={10} />
      <Rect x={9} y={9} width={6} height={6} rx={1} />
    </LucideIcon>
  );
}

/** สถานะพัก */
export function CoffeeIcon(p: IconProps) {
  return (
    <LucideIcon {...p}>
      <Path d="M10 2v2" />
      <Path d="M14 2v2" />
      <Path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
      <Path d="M6 2v2" />
    </LucideIcon>
  );
}

/** ตัวกรอง "ทั้งหมด" */
export function ChartColumnIcon(p: IconProps) {
  return (
    <LucideIcon {...p}>
      <Path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <Path d="M18 17V9" />
      <Path d="M13 17V5" />
      <Path d="M8 17v-3" />
    </LucideIcon>
  );
}

/** ตัวกรอง "ระบุแล้ว" */
export function CircleCheckIcon(p: IconProps) {
  return (
    <LucideIcon {...p}>
      <Circle cx={12} cy={12} r={10} />
      <Path d="m9 12 2 2 4-4" />
    </LucideIcon>
  );
}

/** ตัวกรอง "รอระบุ" */
export function CircleXIcon(p: IconProps) {
  return (
    <LucideIcon {...p}>
      <Circle cx={12} cy={12} r={10} />
      <Path d="m15 9-6 6" />
      <Path d="m9 9 6 6" />
    </LucideIcon>
  );
}

/** ปุ่มเรียงลำดับรายการ (arrow-down-wide-narrow) */
export function SortIcon(p: IconProps) {
  return (
    <LucideIcon {...p}>
      <Path d="m3 16 4 4 4-4" />
      <Path d="M7 20V4" />
      <Path d="M11 4h10" />
      <Path d="M11 8h7" />
      <Path d="M11 12h4" />
    </LucideIcon>
  );
}

import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { formatDateString } from '@/api/idle-rules';
import { font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useColors } from '@/context/theme-context';

/** ปฏิทินวางเต็ม 6 สัปดาห์เสมอ ความสูงจะได้ไม่กระโดดตอนเปลี่ยนเดือน */
const WEEKS = 6;
const DAYS_IN_WEEK = 7;

const MONTHS = {
  th: [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
} as const;

const WEEKDAYS = {
  th: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
  en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
} as const;

interface Props {
  visible: boolean;
  /** วันที่ที่เลือกอยู่ รูปแบบ "YYYY-MM-DD" */
  value: string;
  /** วันที่ล่าสุดที่เลือกได้ ปกติคือวันที่ของกะปัจจุบัน */
  maxDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}

/** "2026-09-10" -> Date ที่เที่ยงวัน กันปัญหาเขตเวลาเลื่อนไปวันก่อนหน้า */
function parse(dateString: string) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/**
 * ปฏิทินเลือกวันแบบการ์ด
 *
 * หน้าตาอิงจาก Calendar ของ antd แบบ fullscreen={false} แต่เขียนด้วยคอมโพเนนต์ของ
 * React Native ทั้งหมด เพราะ antd เป็นไลบรารีของเว็บที่ใช้ในแอปไม่ได้
 *
 * ที่ไม่ใช้ dialog ของระบบต่อไปเพราะคุมหน้าตาไม่ได้ ทั้งขนาด สี และภาษา
 * ซึ่งบนหน้างานทำให้ผู้ใช้สะดุด เพราะหน้าตาไม่เหมือนส่วนอื่นของแอป
 */
export default function MonthCalendar({ visible, value, maxDate, onSelect, onClose }: Props) {
  const c = useColors();
  const { language } = useLanguage();
  const styles = useMemo(() => createStyles(c), [c]);

  const selected = parse(value);
  /** เดือนที่กำลังเปิดดู แยกจากวันที่ที่เลือก เพื่อให้พลิกดูเดือนอื่นได้โดยยังไม่ต้องเลือก */
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const max = parse(maxDate);
  const todayKey = formatDateString(new Date());

  /** ช่องทั้งหมดของตาราง เริ่มจากวันอาทิตย์ก่อนวันที่ 1 ของเดือนที่เปิดอยู่ */
  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1, 12);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: WEEKS * DAYS_IN_WEEK }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [viewYear, viewMonth]);

  function shiftMonth(step: number) {
    const next = new Date(viewYear, viewMonth + step, 1, 12);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  const monthLabel = `${MONTHS[language][viewMonth]} ${viewYear}`;
  /** เดือนถัดไปกดได้ก็ต่อเมื่อยังมีวันที่เลือกได้อยู่ในนั้น */
  const canGoNext = new Date(viewYear, viewMonth + 1, 1, 12) <= max;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* แตะนอกการ์ดเพื่อปิด เป็นท่าที่คนคุ้นอยู่แล้ว */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* ครอบด้วย Pressable เปล่าเพื่อไม่ให้การแตะในการ์ดทะลุไปปิดหน้าต่าง */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={spacing.md} style={styles.navButton}>
              <Text style={styles.navText}>‹</Text>
            </TouchableOpacity>

            <Text style={styles.monthLabel}>{monthLabel}</Text>

            <TouchableOpacity
              onPress={() => canGoNext && shiftMonth(1)}
              disabled={!canGoNext}
              hitSlop={spacing.md}
              style={[styles.navButton, !canGoNext && styles.navDisabled]}>
              <Text style={styles.navText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS[language].map((w) => (
              <Text key={w} style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((d) => {
              const key = formatDateString(d);
              const outside = d.getMonth() !== viewMonth;
              const disabled = d > max;
              const isSelected = key === value;
              const isToday = key === todayKey;

              return (
                <TouchableOpacity
                  key={key}
                  style={styles.cell}
                  disabled={disabled}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelect(key);
                    onClose();
                  }}>
                  <View
                    style={[
                      styles.dayBox,
                      isToday && !isSelected && styles.dayToday,
                      isSelected && styles.daySelected,
                    ]}>
                    <Text
                      style={[
                        styles.dayText,
                        outside && styles.dayOutside,
                        disabled && styles.dayDisabled,
                        isSelected && styles.daySelectedText,
                      ]}>
                      {d.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: c.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    navButton: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
    },
    navDisabled: { opacity: 0.3 },
    navText: { color: c.primary, fontSize: font.h2, lineHeight: font.h2 + 6 },
    monthLabel: { color: c.textPrimary, fontSize: font.body, fontWeight: '600' },
    weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
    weekday: {
      flex: 1,
      textAlign: 'center',
      color: c.textSecondary,
      fontSize: font.small,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    // 100/7 ให้เจ็ดช่องพอดีแถว ไม่ใช้ค่าคงที่เพราะความกว้างการ์ดยืดตามจอ
    cell: { width: `${100 / DAYS_IN_WEEK}%`, aspectRatio: 1, padding: 2 },
    dayBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    dayToday: { borderColor: c.primary },
    daySelected: { backgroundColor: c.primary },
    dayText: { color: c.textPrimary, fontSize: font.body, fontVariant: ['tabular-nums'] },
    /** วันของเดือนอื่นที่ล้นมาเติมตาราง ยังกดได้แต่ให้จางลงเพื่อไม่ให้สับสน */
    dayOutside: { color: c.textSecondary },
    dayDisabled: { opacity: 0.25 },
    daySelectedText: { color: c.onPrimary, fontWeight: '700' },
  });

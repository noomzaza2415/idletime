import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { controlHeight, font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useColors } from '@/context/theme-context';

interface Props {
  lines: string[]; // เช่น ['Line1', 'Line2']
  selected: string;
  onSelect: (line: string) => void;
}

/**
 * ปุ่มเลือกไลน์ทรง segmented control
 *
 * ตัวที่เลือกเป็นสีหลักทึบ ตัวที่ไม่ได้เลือกกลืนไปกับถาด แยกกันได้ด้วยสีพื้นอย่างเดียว
 * ไม่ต้องพึ่งเงาหรือภาพไล่สี จึงอ่านออกเท่ากันทั้งโหมดมืดและสว่าง และใต้แสงจ้าหน้าไลน์
 * สูงเท่า controlHeight ให้เป้ากดใหญ่พอสำหรับมือที่สวมถุงมือ แต่ไม่กินพื้นที่รายการ
 */
export default function LineTabs({ lines, selected, onSelect }: Props) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);

  return (
    <View style={styles.tray} accessibilityRole="radiogroup">
      {lines.map((line) => {
        const active = line === selected;
        return (
          <TouchableOpacity
            key={line}
            onPress={() => onSelect(line)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={[styles.tab, active && styles.tabActive]}>
            <Text style={[styles.text, active && styles.textActive]}>{line}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    tray: {
      flexDirection: 'row',
      gap: spacing.xs,
      padding: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    tab: {
      flex: 1,
      height: controlHeight,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
    },
    tabActive: { backgroundColor: c.primary },
    text: {
      fontSize: font.body,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: c.textSecondary,
    },
    textActive: { color: c.onPrimary },
  });

import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { controlHeight, font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useColors } from '@/context/theme-context';

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  /** ป้ายกำกับปุ่มล้างข้อความ สำหรับ screen reader */
  clearLabel: string;
}

/**
 * ช่องค้นหาแบบหน้าจอควบคุม: พื้นทึบ ขอบชัด โฟกัสแล้วขอบเป็นสีหลักและหนาขึ้น
 *
 * เดิมเป็นขอบเรืองแสงหมุนตลอดเวลา (พอร์ตจาก Uiverse) ซึ่งสั่งให้ GPU วาดแผ่นไล่สี
 * 560x560 สองชั้นทุกเฟรมตลอดที่อยู่หน้ารายการ กินแบตมือถือรุ่นกลางที่เปิดค้างทั้งกะ
 * และสีม่วงชมพูไม่ได้สื่อความหมายอะไร ขัดกับหลักที่สีในแอปนี้ใช้บอกสถานะเท่านั้น
 */
export default function SearchField({ value, onChangeText, placeholder, clearLabel }: Props) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      <View style={styles.searchIcon}>
        <View style={[styles.searchLens, focused && styles.iconFocused]} />
        <View style={[styles.searchHandle, focused && styles.handleFocused]} />
      </View>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textSecondary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // work order เป็นรหัสตัวพิมพ์ใหญ่ผสมตัวเลข ปิด autocorrect ไม่ให้แก้คำมั่ว
        autoCapitalize="characters"
        autoCorrect={false}
        spellCheck={false}
        returnKeyType="search"
      />

      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          hitSlop={spacing.sm}
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          style={styles.reset}>
          <View style={styles.resetLine} />
          <View style={[styles.resetLine, styles.resetLineFlipped]} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      height: controlHeight,
      paddingHorizontal: spacing.md,
      backgroundColor: c.surface,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    fieldFocused: { borderColor: c.focusAccent, borderWidth: 2 },
    searchIcon: { width: 20, height: 20, marginRight: spacing.sm },
    searchLens: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: c.textSecondary,
    },
    searchHandle: {
      position: 'absolute',
      right: 1,
      bottom: 2,
      width: 8,
      height: 2,
      borderRadius: 1,
      backgroundColor: c.textSecondary,
      transform: [{ rotate: '45deg' }],
    },
    iconFocused: { borderColor: c.focusAccent },
    handleFocused: { backgroundColor: c.focusAccent },
    input: {
      flex: 1,
      height: '100%',
      paddingHorizontal: spacing.xs,
      fontSize: font.body,
      color: c.textPrimary,
    },
    reset: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      backgroundColor: c.border,
      marginLeft: spacing.sm,
    },
    resetLine: {
      position: 'absolute',
      width: 14,
      height: 2,
      borderRadius: 1,
      backgroundColor: c.textPrimary,
      transform: [{ rotate: '45deg' }],
    },
    resetLineFlipped: { transform: [{ rotate: '-45deg' }] },
  });

import { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { spacing, type ThemeColors } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/context/theme-context';

/** ปุ่มสลับโหมดมืด/สว่าง มุมขวาบน — แตะสลับไปมา */
export default function ThemeButton() {
  const { colors: c, isDark, toggleMode } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(c), [c]);

  return (
    <TouchableOpacity
      onPress={toggleMode}
      style={styles.button}
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={t('darkMode')}>
      {/* วาดไอคอนเองด้วย View เหมือนปุ่มอื่นในแอป เลี่ยงปัญหา glyph บน Android */}
      {isDark ? (
        // พระจันทร์เสี้ยว: วงกลมทึบแล้วเอาวงกลมสีพื้นหลังมาบังให้เว้าเป็นเสี้ยว
        <View style={styles.moon}>
          <View style={styles.moonCutout} />
        </View>
      ) : (
        // ดวงอาทิตย์: วงกลมทึบ ล้อมด้วยวงแหวนบาง ๆ แทนแฉกรัศมี
        <View style={styles.sun}>
          <View style={styles.sunCore} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    button: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
    moon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.primary,
      overflow: 'hidden',
    },
    /** วงกลมสีเดียวกับพื้นหลังแถบหัว วางเยื้องไปขวาบนเพื่อกัดให้เป็นเสี้ยว */
    moonCutout: {
      position: 'absolute',
      top: -5,
      right: -5,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: c.surface,
    },
    sun: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sunCore: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.primary },
  });

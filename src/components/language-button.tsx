import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { LANGUAGE_LABEL } from '@/constants/i18n';
import { font, spacing, type ThemeColors } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useColors } from '@/context/theme-context';

/** ปุ่มสลับไทย/อังกฤษ มุมขวาบน — แตะสลับสองภาษาไปมา */
export default function LanguageButton() {
  const c = useColors();
  const { language, toggleLanguage, t } = useLanguage();
  const styles = useMemo(() => createStyles(c), [c]);

  return (
    <TouchableOpacity
      onPress={toggleLanguage}
      style={styles.button}
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityLabel={t('switchLanguage')}>
      {/* วาดลูกโลกเองด้วย View แทน emoji 🌐 เพราะ glyph บน Android แสดงไม่ตรงกันในแต่ละเครื่อง */}
      <View style={styles.globe}>
        <View style={styles.equator} />
        <View style={styles.meridian} />
      </View>
      <Text style={styles.label}>{LANGUAGE_LABEL[language]}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingLeft: spacing.md,
    },
    globe: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /** เส้นศูนย์สูตรพาดกลางลูกโลก */
    equator: { width: '100%', height: 1.5, backgroundColor: c.primary },
    /** วงรีแนวตั้งซ้อนทับ ทำให้อ่านออกว่าเป็นลูกโลก */
    meridian: {
      position: 'absolute',
      width: 8,
      height: '100%',
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: c.primary,
    },
    label: { fontSize: font.small, fontWeight: '700', color: c.primary },
  });

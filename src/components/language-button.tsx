import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { LANGUAGE_LABEL } from '@/constants/i18n';
import { font, radius, spacing, type ThemeColors } from '@/constants/theme';
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
      {/* วาดลูกโลกด้วย SVG แทน emoji 🌐 เพราะ glyph บน Android แสดงไม่ตรงกันในแต่ละเครื่อง */}
      <GlobeIcon color={c.primary} />
      <Text style={styles.label}>{LANGUAGE_LABEL[language]}</Text>
    </TouchableOpacity>
  );
}

function GlobeIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
      {/* เส้นศูนย์สูตร + เส้นเมริเดียนโค้ง */}
      <Path
        d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    /** แคปซูลพื้นอ่อน สูงเท่าปุ่มธีมที่อยู่ข้างกัน */
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs + 2,
      height: 40,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: c.chipBg,
    },
    label: { fontSize: font.small, fontWeight: '700', color: c.primary },
  });

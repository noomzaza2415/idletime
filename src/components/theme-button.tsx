import { useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { radius, spacing, type ThemeColors } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/context/theme-context';

/** ปุ่มสลับโหมดมืด/สว่าง มุมขวาบน — แตะสลับไปมา */
/** onDark = วางบนหัวจอสีน้ำเงิน พื้นขาวโปร่ง ไอคอนขาว */
export default function ThemeButton({ onDark }: { onDark?: boolean }) {
  const { colors: c, isDark, toggleMode } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(c), [c]);

  return (
    <TouchableOpacity
      onPress={toggleMode}
      style={[styles.button, onDark && styles.buttonOnDark]}
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={t('darkMode')}>
      {/* วาดด้วย SVG เหมือนไอคอนอื่นในแอป เลี่ยงปัญหา glyph/emoji บน Android */}
      <SunMoonIcon color={onDark ? '#FFFFFF' : c.primary} />
    </TouchableOpacity>
  );
}

/**
 * ไอคอนครึ่งพระอาทิตย์ครึ่งพระจันทร์ วาดตามแบบ "sun-moon" ของ Lucide (ISC license)
 * ใช้ไอคอนเดียวทั้งสองโหมด สื่อว่าเป็นปุ่มสลับกลางวัน/กลางคืน
 * เดิมสลับรูปตามโหมดปัจจุบัน คนอ่านไม่ออกว่ารูปบอกโหมดที่ใช้อยู่หรือโหมดที่จะเปลี่ยนไป
 */
function SunMoonIcon({ color }: { color: string }) {
  return (
    <Svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round">
      <Path d="M12 2v2" />
      <Path d="M14.837 16.385a6 6 0 1 1-7.223-7.222c.624-.147.97.66.715 1.248a4 4 0 0 0 5.26 5.259c.589-.255 1.396.09 1.248.715" />
      <Path d="M16 12a4 4 0 0 0-4-4" />
      <Path d="m19 5-1.256 1.256" />
      <Path d="M20 12h2" />
    </Svg>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    /** พื้นวงกลมอ่อน ให้เข้าชุดกับปุ่มภาษาที่อยู่ข้างกัน */
    button: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: c.chipBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonOnDark: { backgroundColor: 'rgba(255,255,255,0.18)' },
  });

import { useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { radius, spacing, type ThemeColors } from '@/constants/theme';
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
      {/* วาดด้วย SVG เหมือนไอคอนอื่นในแอป เลี่ยงปัญหา glyph/emoji บน Android */}
      {isDark ? <MoonIcon color={c.primary} /> : <SunIcon color={c.primary} />}
    </TouchableOpacity>
  );
}

function MoonIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
        fill={color}
        fillOpacity={0.25}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SunIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={4} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={2} />
      {/* แฉกรัศมี 8 ทิศ */}
      <Path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
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
  });

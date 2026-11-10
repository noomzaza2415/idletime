import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { OptionSheet } from '@/components/line-picker';
import { LANGUAGE_LABEL, LANGUAGE_NAME, LANGUAGES } from '@/constants/i18n';
import { COMPACT_WIDTH, font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useColors } from '@/context/theme-context';

/**
 * ปุ่มเลือกภาษา มุมขวาบน แตะแล้วเปิดแผ่นเลือกภาษา
 * เดิมแตะสลับไทย/อังกฤษไปมา พอมีสามภาษาการวนทีละภาษาต้องแตะหลายครั้งและเดาไม่ได้ว่าจะได้ภาษาไหน
 */
/** onDark = วางบนหัวจอสีน้ำเงิน พื้นขาวโปร่ง ตัวอักษรขาว */
export default function LanguageButton({ onDark }: { onDark?: boolean }) {
  const c = useColors();
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const styles = useMemo(() => createStyles(c), [c]);
  // จอเล็กเหลือแค่ TH/EN ให้หัวเรื่องมีที่พอ ตัวอักษรยังบอกได้ว่าเป็นปุ่มภาษา
  const compact = useWindowDimensions().width < COMPACT_WIDTH;

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[styles.button, onDark && styles.buttonOnDark]}
        hitSlop={spacing.sm}
        accessibilityRole="button"
        accessibilityLabel={t('switchLanguage')}>
        {/* วาดด้วย SVG แทน emoji เพราะ glyph บน Android แสดงไม่ตรงกันในแต่ละเครื่อง */}
        {!compact && <LanguagesIcon color={onDark ? '#FFFFFF' : c.primary} />}
        <Text style={[styles.label, onDark && styles.labelOnDark]}>{LANGUAGE_LABEL[language]}</Text>
      </TouchableOpacity>
      <OptionSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t('selectLanguage')}
        options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_NAME[l] }))}
        selected={language}
        onSelect={(l) => void setLanguage(l)}
      />
    </>
  );
}

/**
 * ไอคอนตัวอักษรสองภาษา (文 + A) วาดตามแบบ "languages" ของ Lucide (ISC license)
 * สื่อตรงกว่าลูกโลก ซึ่งคนอ่านเป็น "อินเทอร์เน็ต" หรือ "ภูมิภาค" ได้
 */
function LanguagesIcon({ color }: { color: string }) {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round">
      <Path d="m5 8 6 6" />
      <Path d="m4 14 6-6 2-3" />
      <Path d="M2 5h12" />
      <Path d="M7 2h1" />
      <Path d="m22 22-5-10-5 10" />
      <Path d="M14 18h6" />
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
    buttonOnDark: { backgroundColor: 'rgba(255,255,255,0.18)' },
    labelOnDark: { color: '#FFFFFF' },
  });

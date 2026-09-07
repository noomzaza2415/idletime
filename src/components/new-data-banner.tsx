import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { elevation, font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useColors } from '@/context/theme-context';

interface Props {
  count: number;
  /** โหลดรายการใหม่แล้วซ่อนแถบนี้ */
  onPress: () => void;
}

/**
 * แถบแจ้งว่ามีรายการใหม่เข้ามาระหว่างเปิดหน้าค้างไว้
 * ใช้คู่กับ push notification — อันนั้นสำหรับตอนไม่ได้มองจอ อันนี้สำหรับตอนกำลังมองอยู่
 */
export default function NewDataBanner({ count, onPress }: Props) {
  const c = useColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(c), [c]);

  if (count <= 0) return null;

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button">
      <Text style={styles.text} numberOfLines={1}>
        {t('newRecordsBanner').replace('{count}', String(count))}
      </Text>
      <Text style={styles.action}>{t('tapToRefresh')}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: c.primary,
      ...elevation.card,
    },
    text: { flexShrink: 1, fontSize: font.body, fontWeight: '700', color: c.onPrimary },
    action: { fontSize: font.small, fontWeight: '700', color: c.onPrimary, opacity: 0.85 },
  });

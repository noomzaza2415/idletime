import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { elevation, font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useColors } from '@/context/theme-context';

interface Props {
  workOrder: string;
  modelSuffix: string;
  /** จำนวนรายการทั้งหมดใน work order นี้ */
  count: number;
  /** ผลรวมนาทีที่หยุดของทุกรายการในกลุ่ม */
  totalMins: number;
  /** จำนวนรายการที่ยังไม่ได้กรอกสาเหตุ */
  pendingCount: number;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * หัวข้อกลุ่มของ work order หนึ่งใบ แตะเพื่อกางรายการย่อยข้างใน
 * สีตามเดิมของแอป: ยังมีรายการค้างกรอก = แดง, กรอกครบแล้ว = เขียว
 */
export default function WorkOrderGroup({
  workOrder,
  modelSuffix,
  count,
  totalMins,
  pendingCount,
  expanded,
  onToggle,
}: Props) {
  const c = useColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(c), [c]);
  const allDone = pendingCount === 0;

  return (
    <TouchableOpacity
      style={[
        styles.group,
        allDone ? styles.groupDone : styles.groupPending,
        expanded && styles.groupExpanded,
      ]}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ expanded }}>
      <View style={styles.headerRow}>
        <Text style={styles.workOrder} numberOfLines={1}>
          {workOrder}
        </Text>
        <View style={[styles.badge, allDone ? styles.badgeDone : styles.badgePending]}>
          <Text style={styles.badgeText}>
            {allDone ? t('allDone') : `${pendingCount} ${t('pendingCount')}`}
          </Text>
        </View>
      </View>

      <Text style={styles.model} numberOfLines={1}>
        {modelSuffix}
      </Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {count} {t('itemsCount')}
        </Text>
        <View style={styles.metaRight}>
          <Text style={styles.totalMins}>{totalMins.toFixed(2)} min</Text>
          {/* ใช้สามเหลี่ยมแบบเดียวกับปุ่ม "ข้อมูลเพิ่มเติม" ในหน้ารายละเอียด */}
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    group: {
      backgroundColor: c.surface,
      borderRadius: radius.md,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      ...elevation.card,
    },
    /** ตอนกางอยู่ ให้หัวข้อเชื่อมติดกับรายการย่อยด้านล่าง จึงตัดมุมล่างและระยะห่างออก */
    groupExpanded: {
      marginBottom: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderBottomWidth: 0,
    },
    groupPending: { backgroundColor: c.cardPendingBg, borderColor: c.danger },
    groupDone: { backgroundColor: c.badgeDoneBg, borderColor: c.success },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    workOrder: {
      fontSize: font.h2,
      fontWeight: '700',
      color: c.textPrimary,
      flexShrink: 1,
    },
    badge: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      flexShrink: 0,
      marginLeft: spacing.sm,
    },
    badgeDone: { backgroundColor: c.statusDoneFill },
    badgePending: { backgroundColor: c.statusPendingFill },
    badgeText: { fontSize: font.small, fontWeight: '700', color: c.onStatus },
    model: { fontSize: font.small, color: c.textSecondaryStrong, marginTop: spacing.xs },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.md,
    },
    metaText: { fontSize: font.small, color: c.textSecondaryStrong },
    metaRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    totalMins: { fontSize: font.body, fontWeight: '700', color: c.danger },
    chevron: { fontSize: font.small, color: c.primary },
  });

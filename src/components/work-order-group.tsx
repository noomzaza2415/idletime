import { memo, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { elevation, font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useColors } from '@/context/theme-context';

interface Props {
  workOrder: string;
  modelSuffix: string;
  /** จำนวนรายการทั้งหมดใน work order นี้ */
  count: number;
  /** เวลาเริ่มของรายการแรกในกลุ่ม */
  startTime: string;
  /** เวลาจบของรายการสุดท้ายในกลุ่ม */
  endTime: string;
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
function WorkOrderGroupBase({
  workOrder,
  modelSuffix,
  count,
  startTime,
  endTime,
  totalMins,
  pendingCount,
  expanded,
  onToggle,
}: Props) {
  const c = useColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(c), [c]);
  const allDone = pendingCount === 0;
  const doneCount = count - pendingCount;
  /** สัดส่วนที่กรอกสาเหตุแล้ว ใช้วาดหลอดความคืบหน้า */
  const doneRatio = count > 0 ? doneCount / count : 0;

  /**
   * สีหลอดไล่ตามระดับความคืบหน้า ไม่ใช่แค่ครบกับไม่ครบ
   *
   * ทำให้ operator กวาดสายตาทีเดียวแล้วรู้ว่ากลุ่มไหนเพิ่งเริ่มและกลุ่มไหนใกล้เสร็จ
   * โดยไม่ต้องเพ่งอ่านความยาวหลอดหรือตัวเลขทีละใบ
   *
   * แดง = ยังไม่ถึงครึ่ง, เหลือง = เกินครึ่งแต่ยังไม่ครบ, เขียว = ครบทุกรายการ
   */
  const progressColor =
    doneRatio >= 1 ? c.statusDoneFill : doneRatio >= 0.5 ? c.warning : c.statusPendingFill;

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

      {/*
        ช่วงเวลาของทั้งกลุ่ม คือเวลาเริ่มของรายการแรกถึงเวลาจบของรายการสุดท้าย
        ทำให้รู้ได้ทันทีว่ากลุ่มนี้เกิดช่วงไหนของกะ โดยไม่ต้องกดเปิดดูรายการย่อย
        วางบรรทัดเดียวกับ model ให้หัวกลุ่มเตี้ยลง เหมือนการ์ดรายการ
      */}
      <Text style={styles.model} numberOfLines={1}>
        <Text style={styles.timeRange}>
          {startTime} - {endTime}
        </Text>
        {'  ·  '}
        {modelSuffix}
      </Text>

      {/*
        หลอดบอกว่ากรอกสาเหตุไปแล้วกี่รายการจากทั้งหมด
        เห็นความคืบหน้าได้จากระยะไกลกว่าการอ่านตัวเลข ซึ่งช่วยตอนกวาดสายตาหาว่ายังเหลืองานตรงไหน
      */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.round(doneRatio * 100)}%`, backgroundColor: progressColor },
          ]}
        />
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {doneCount}/{count} {t('itemsCount')}
        </Text>
        <View style={styles.metaRight}>
          <Text style={[styles.totalMins, allDone && styles.totalMinsDone]}>
            {totalMins.toFixed(2)} min
          </Text>
          {/* ใช้สามเหลี่ยมแบบเดียวกับปุ่ม "ข้อมูลเพิ่มเติม" ในหน้ารายละเอียด */}
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** เหตุผลเดียวกับ RecordCard คือกันไม่ให้ทั้งลิสต์เรนเดอร์ใหม่เมื่อกดกลุ่มเดียว */
const WorkOrderGroup = memo(WorkOrderGroupBase);
export default WorkOrderGroup;

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    /** แถบสีซ้ายและพื้นแดงอ่อนเฉพาะกลุ่มที่ยังค้าง ตามหลักเดียวกับ RecordCard */
    group: {
      backgroundColor: c.surface,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
      borderLeftWidth: 6,
      ...elevation.card,
    },
    /** ตอนกางอยู่ ให้หัวข้อเชื่อมติดกับรายการย่อยด้านล่าง จึงตัดมุมล่างและระยะห่างออก */
    groupExpanded: {
      marginBottom: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderBottomWidth: 0,
    },
    groupPending: {
      backgroundColor: c.cardPendingBg,
      borderColor: c.danger,
      borderLeftColor: c.statusPendingFill,
    },
    groupDone: { borderLeftColor: c.statusDoneFill },
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
    timeRange: {
      color: c.textPrimary,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.border,
      overflow: 'hidden',
      marginTop: spacing.sm,
    },
    progressFill: { height: '100%', borderRadius: 3 },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    metaText: { fontSize: font.small, fontWeight: '600', color: c.textSecondaryStrong },
    metaRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    totalMins: {
      fontSize: font.body,
      fontWeight: '800',
      color: c.danger,
      fontVariant: ['tabular-nums'],
    },
    totalMinsDone: { color: c.textPrimary },
    chevron: { fontSize: font.small, color: c.primary },
  });

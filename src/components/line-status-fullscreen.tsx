import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDateString } from '@/api/idle-rules';
import {
  viewTimeline,
  type LineTimeline,
  type RangeHours,
  type TimelineSegment,
} from '@/api/line-timeline';
import {
  hhmm,
  hhmmss,
  statusColors,
  TimelineBar,
  useNow,
  withAlpha,
} from '@/components/line-status-timeline';
import type { TranslationKey } from '@/constants/i18n';
import { font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/context/theme-context';

interface Props {
  visible: boolean;
  onClose: () => void;
  timeline: LineTimeline;
  line: string;
  isToday: boolean;
}

/** ขนาดพื้นที่กดของปุ่ม ไม่ต่ำกว่า 44dp ให้กดโดนแม้สวมถุงมือ */
const TOUCH = 44;

/** ปุ่มเลือกช่วงเวลา เรียงแบบเดียวกับเว็บ */
const RANGES: { value: RangeHours; label: TranslationKey }[] = [
  { value: 8, label: 'timelineRange8' },
  { value: 12, label: 'timelineRange12' },
  { value: 24, label: 'timelineRangeAll' },
];

/** ขอบเขตซูมเท่ากับปุ่ม − / + ของเว็บ */
const MIN_ZOOM = 1;
const MAX_ZOOM = 10;

/** "175.3" นาที -> "2:55" */
function hoursMinutes(mins: number) {
  const total = Math.round(mins);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * แถบสถานะไลน์แบบเต็มจอ บังคับแนวนอน
 *
 * ทำงานเหมือน StatusTimelineBar ของเว็บ: เลือกช่วง 8 ชม. / 12 ชม. / ทั้งวัน ซูม 1x-10x
 * และดูรายละเอียดของแต่ละช่วงหยุด ต่างกันตรงวิธีสั่งให้เหมาะกับนิ้ว คือ
 * ซูมด้วยปุ่ม − / + แทนล้อเมาส์ ลากนิ้วเลื่อนแทนลากเมาส์ และแตะช่วงหยุดแทนการชี้ค้าง
 *
 * ด้านบนเพิ่มตัวเลขสรุปสามช่อง (เดินงาน หยุด พัก) ให้ลีดเดอร์ตอบได้ในไม่กี่วินาทีว่ากะนี้เป็นอย่างไร
 *
 * status bar ยังแสดงอยู่ เพราะ Android แบบ edge-to-edge ไม่ให้ซ่อน จึงเว้นระยะด้านบนเอง
 * ทั้งแอปยังล็อกแนวตั้งตาม app.json หน้านี้ล็อกแนวนอนเฉพาะตอนเปิดอยู่ แล้วคืนเป็นแนวตั้งเมื่อปิด
 */
export default function LineStatusFullscreen({ visible, onClose, timeline, line, isToday }: Props) {
  const { colors: c, isDark } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(c), [c]);
  const colors = useMemo(() => statusColors(c, isDark), [c, isDark]);
  const now = useNow(isToday && visible);

  // ค่าเริ่มต้นเท่าเว็บ คือทั้งวันและไม่ซูม
  const [range, setRange] = useState<RangeHours>(24);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [selected, setSelected] = useState<TimelineSegment | null>(null);

  useEffect(() => {
    if (!visible) return;
    // หมุนไม่สำเร็จไม่ควรทำให้ดูข้อมูลไม่ได้ ยังเห็นหน้าเต็มจอในแนวตั้งอยู่
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [visible]);

  const view = useMemo(() => viewTimeline(timeline, now, range), [timeline, now, range]);

  // ช่วงที่เลือกไว้อาจหายไปเมื่อเปลี่ยนช่วงเวลาหรือข้อมูลอัปเดต ใช้ข้อมูลล่าสุดของ id เดิมเสมอ
  const current = selected ? (view.segments.find((s) => s.id === selected.id) ?? null) : null;

  const endLabel =
    isToday && view.end === now ? `${t('timelineNow')} ${hhmm(now)}` : hhmm(view.end);
  const times = (count: number) => t('timelineTimes').replace('{count}', String(count));

  const stats = [
    {
      key: 'running',
      color: colors.running,
      label: t('timelineRunning'),
      value: hoursMinutes(view.runningMins),
      unit: t('timelineHours'),
      sub: `${Math.round(view.runningRatio * 100)}% ${t('timelineOfTime')}`,
    },
    {
      key: 'stop',
      color: colors.stop,
      label: t('timelineStop'),
      value: String(Math.round(view.stopMins)),
      unit: t('timelineMinutes'),
      sub: times(view.stopCount),
    },
    {
      key: 'break',
      color: colors.break,
      label: t('timelineBreak'),
      value: String(Math.round(view.breakMins)),
      unit: t('timelineMinutes'),
      sub: times(view.breakCount),
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
      statusBarTranslucent
      navigationBarTranslucent>
      <View
        style={[
          styles.screen,
          {
            paddingTop: Math.max(insets.top, spacing.md),
            // จอแนวนอนมีรอยบากหรือแถบ gesture อยู่ด้านข้าง เว้นให้พ้นไม่ให้ทับเนื้อหา
            paddingLeft: Math.max(insets.left, spacing.lg),
            paddingRight: Math.max(insets.right, spacing.lg),
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}>
        <View style={styles.header}>
          <View style={styles.linePill}>
            <Text style={styles.linePillText}>{line.toUpperCase()}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {t('timelineTitle')}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {formatDateString(new Date(timeline.shiftStart))} ·{' '}
              {isToday ? t('shiftToday') : t('shiftPast')}
            </Text>
          </View>

          <View style={styles.segmented}>
            {RANGES.map((r) => {
              const active = r.value === range;
              return (
                <TouchableOpacity
                  key={r.value}
                  onPress={() => {
                    setRange(r.value);
                    setSelected(null);
                  }}
                  style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}>
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {t(r.label)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.zoomGroup}>
            <TouchableOpacity
              onPress={() => setZoom((z) => Math.max(z - 1, MIN_ZOOM))}
              disabled={zoom <= MIN_ZOOM}
              style={[styles.zoomButton, zoom <= MIN_ZOOM && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel={t('timelineZoomOut')}>
              <View style={styles.zoomLine} />
            </TouchableOpacity>
            <Text style={styles.zoomValue}>{zoom}x</Text>
            <TouchableOpacity
              onPress={() => setZoom((z) => Math.min(z + 1, MAX_ZOOM))}
              disabled={zoom >= MAX_ZOOM}
              style={[styles.zoomButton, zoom >= MAX_ZOOM && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel={t('timelineZoomIn')}>
              <View style={styles.zoomLine} />
              <View style={[styles.zoomLine, styles.zoomLineVertical]} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={t('timelineClose')}>
            {/* วาดกากบาทเอง แทนตัวอักษร ✕ ที่บาง font บน Android แสดงไม่ขึ้น */}
            <View style={[styles.closeLine, styles.closeLineA]} />
            <View style={[styles.closeLine, styles.closeLineB]} />
          </TouchableOpacity>
        </View>

        <View style={styles.stats}>
          {stats.map((s) => (
            <View
              key={s.key}
              style={[
                styles.stat,
                // พื้นและขอบย้อมสีตามสถานะ ให้แยกช่องได้ด้วยสีแวบเดียวโดยไม่ต้องอ่านหัวข้อ
                {
                  backgroundColor: withAlpha(s.color, isDark ? 0.16 : 0.1),
                  borderColor: withAlpha(s.color, isDark ? 0.45 : 0.35),
                },
              ]}>
              <View style={[styles.statAccent, { backgroundColor: s.color }]} />
              <Text style={[styles.statLabel, { color: s.color }]} numberOfLines={1}>
                {s.label}
              </Text>
              {/* ตัวเลขชิดซ้าย บรรทัดรองชิดขวาในแถวเดียวกัน ให้เนื้อหาเต็มความกว้างของช่อง */}
              <View style={styles.statBody}>
                <Text style={styles.statValueRow} numberOfLines={1}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statUnit}> {s.unit}</Text>
                </Text>
                <Text style={styles.statSub} numberOfLines={1}>
                  {s.sub}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.chart}>
          {/* สูงคงที่ ไม่ว่าจะมีรายละเอียดหรือไม่ แถบด้านล่างจะได้ไม่ขยับขึ้นลงตอนแตะ */}
          <View style={styles.detailRow}>
            {current ? (
              <>
                <View style={[styles.detailDot, { backgroundColor: colors[current.kind] }]} />
                <Text style={styles.detailText} numberOfLines={1}>
                  <Text style={styles.detailStrong}>
                    {t(current.kind === 'break' ? 'timelinePlanStop' : 'timelineLineStop')}
                  </Text>
                  {`  ${hhmmss(current.start)} – ${hhmmss(current.end)}  ·  `}
                  <Text style={styles.detailStrong}>
                    {current.mins.toFixed(2)} {t('timelineMinutes')}
                  </Text>
                  {current.status ? `  ·  ${current.status}` : ''}
                </Text>
              </>
            ) : (
              <Text style={styles.detailHint} numberOfLines={1}>
                {t('timelineTapHint')}
              </Text>
            )}
          </View>

          <TimelineBar
            view={view}
            endLabel={endLabel}
            size="full"
            zoom={zoom}
            selectedId={current?.id ?? null}
            onSelect={setSelected}
            style={styles.chartBar}
          />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg, gap: spacing.sm },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    linePill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      backgroundColor: c.primary,
    },
    linePillText: { fontSize: font.body, fontWeight: '800', letterSpacing: 1, color: c.onPrimary },
    headerText: { flex: 1 },
    title: { fontSize: font.h2, fontWeight: '800', color: c.textPrimary },
    subtitle: { fontSize: font.small, color: c.textSecondary, marginTop: 1 },
    segmented: {
      flexDirection: 'row',
      padding: 3,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    segmentButton: {
      minHeight: TOUCH - 6,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
    },
    segmentButtonActive: { backgroundColor: c.primary },
    segmentText: { fontSize: font.small, fontWeight: '700', color: c.textSecondary },
    segmentTextActive: { color: c.onPrimary },
    zoomGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 3,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    zoomButton: {
      width: TOUCH - 6,
      height: TOUCH - 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
    },
    /** วาดเครื่องหมาย − / + เอง เหตุผลเดียวกับปุ่มปิด */
    zoomLine: {
      position: 'absolute',
      width: 14,
      height: 2.5,
      borderRadius: 2,
      backgroundColor: c.textPrimary,
    },
    zoomLineVertical: { transform: [{ rotate: '90deg' }] },
    zoomValue: {
      minWidth: 34,
      textAlign: 'center',
      fontSize: font.small,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      color: c.textPrimary,
    },
    disabled: { opacity: 0.3 },
    closeButton: {
      width: TOUCH,
      height: TOUCH,
      marginRight: -spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
    },
    closeLine: {
      position: 'absolute',
      width: 20,
      height: 2.5,
      borderRadius: 2,
      backgroundColor: c.textSecondaryStrong,
    },
    closeLineA: { transform: [{ rotate: '45deg' }] },
    closeLineB: { transform: [{ rotate: '-45deg' }] },
    stats: { flexDirection: 'row', gap: spacing.md },
    stat: {
      flex: 1,
      paddingVertical: spacing.xs,
      paddingLeft: spacing.lg,
      paddingRight: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      overflow: 'hidden',
    },
    /** แถบสีด้านซ้าย บอกว่าตัวเลขช่องนี้เป็นของสถานะไหน ตรงกับสีบนแถบเวลา */
    statAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6 },
    statLabel: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
    statBody: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    /** ตัวเลขใหญ่พอให้อ่านได้จากระยะแขน เวลาถือมือถือให้คนอื่นดูหรือวางไว้ข้างไลน์ */
    statValueRow: { flexShrink: 0 },
    statValue: {
      fontSize: 40,
      lineHeight: 46,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      color: c.textPrimary,
    },
    statUnit: { fontSize: 18, fontWeight: '700', color: c.textSecondary },
    statSub: {
      flexShrink: 1,
      fontSize: font.body,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      textAlign: 'right',
      color: c.textSecondaryStrong,
    },
    chart: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    detailRow: {
      height: 26,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    detailDot: { width: 10, height: 10, borderRadius: 5 },
    detailText: {
      flexShrink: 1,
      fontSize: font.small,
      fontVariant: ['tabular-nums'],
      color: c.textSecondaryStrong,
    },
    detailStrong: { fontWeight: '800', color: c.textPrimary },
    detailHint: { fontSize: font.small, color: c.textSecondary },
    chartBar: { flex: 1 },
  });

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  viewTimeline,
  type LineTimeline,
  type SegmentKind,
  type TimelineSegment,
  type TimelineView,
} from '@/api/line-timeline';
import { font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/context/theme-context';

/**
 * แถบสถานะไลน์ตลอดกะ พอร์ตจาก StatusTimelineBar ของหน้าเว็บ
 *
 * ไฟล์นี้มี TimelineBar ที่ใช้ร่วมกันระหว่างการ์ดบนหน้ารายการกับหน้าเต็มจอ และตัวการ์ดเอง
 * ส่วนการคำนวณนาทีหยุด/พักอยู่ใน api/line-timeline.ts ซึ่งตรวจแล้วว่าให้ผลเท่าเว็บ
 */

/** ช่วงหยุดสั้นกว่าหนึ่งพิกเซลยังต้องมองเห็น ไม่งั้นการหยุดสั้น ๆ ถี่ ๆ จะหายไปจากแถบ */
const MIN_SEGMENT_WIDTH = 1.5;

/**
 * ช่วงแสดงผลขั้นต่ำตอนต้นกะ
 * เว็บยืดเวลาที่ผ่านไปเต็มแถบเสมอ ช่วงห้านาทีแรกของกะจึงดูเหมือนหยุดนานมาก
 * บนมือถือกันไว้ที่หนึ่งชั่วโมง ส่วนตัวเลขสรุปยังคิดถึงเวลาปัจจุบันเท่าเว็บ
 */
const MIN_RANGE_MS = 60 * 60_000;

/** เวลาปัจจุบันขยับทุก 30 วินาที เท่ากับรอบ poll ข้อมูล */
const NOW_TICK_MS = 30_000;

/** ระยะเส้นบอกเวลาที่เลือกได้ เล็กไปใหญ่ */
const TICK_STEPS_MS = [5, 10, 15, 30, 60, 120, 240].map((m) => m * 60_000);

/** ระยะแตะที่ยังนับว่าโดนช่วงหยุด ช่วงที่แคบ 1-2 พิกเซลจะได้แตะโดน */
const TOUCH_SLOP_PX = 10;

export function hhmm(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function hhmmss(ms: number) {
  return `${hhmm(ms)}:${String(new Date(ms).getSeconds()).padStart(2, '0')}`;
}

/** "#DC2626" + 0.4 -> "rgba(220,38,38,0.4)" ใช้ทำสีอ่อนจากสีสถานะในธีม */
export function withAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * เลือกระยะเส้นบอกเวลาที่ถี่ที่สุดที่ป้ายยังไม่ชนกัน ตามความกว้างจริงของแถบ
 * ซูมหรือจอแนวนอนทำให้แถบกว้างขึ้น ป้ายจึงถี่ขึ้นเองเหมือนที่เว็บเปลี่ยนระยะตามระดับซูม
 */
function tickStep(spanMs: number, width: number, labelWidth: number) {
  const minGapPx = labelWidth * 1.5;
  return (
    TICK_STEPS_MS.find((step) => (step / spanMs) * width >= minGapPx) ??
    TICK_STEPS_MS[TICK_STEPS_MS.length - 1]
  );
}

/** เวลาปัจจุบันที่ขยับเองเฉพาะตอนต้องใช้ กะย้อนหลังไม่ต้องตั้งตัวจับเวลาให้เปลืองแบต */
export function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

/**
 * นาฬิกาบนป้ายเวลาปัจจุบัน เดินทุกวินาทีแบบ playhead ของเว็บ
 *
 * แยกเป็นคอมโพเนนต์เล็กของตัวเอง ให้ทุกวินาทีวาดใหม่แค่ข้อความนี้
 * ถ้าไปเร่ง useNow ของทั้งแถบเป็นทุกวินาที ช่วงหยุดหลายสิบชิ้นจะถูกวาดใหม่ทุกวินาทีไปด้วย
 * ส่วนตำแหน่งขอบขวาของแถบยังขยับทุก 30 วินาทีเท่าเดิม ต่างกันไม่ถึงครึ่งพิกเซลบนจอ
 */
function LiveClock({ prefix }: { prefix: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <>{`${prefix}${hhmmss(now)}`}</>;
}

/** สีของแต่ละสถานะ ใช้ร่วมกันระหว่างแถบ คำอธิบายสี และตัวเลขสรุป */
export function statusColors(c: ThemeColors, isDark: boolean) {
  return {
    // เวลาเดินงานลดความทึบลงเล็กน้อยให้ช่วงหยุดสีแดงยังเด่นกว่า
    // ไม่ลดมากกว่านี้ เพราะเคยตั้งไว้ราว 35% แล้วทั้งแถบดูซีดจางเกินไป
    runningTrack: withAlpha(c.statusDoneFill, isDark ? 0.72 : 0.6),
    running: c.statusDoneFill,
    stop: c.statusPendingFill,
    break: c.statusBreakFill,
  } satisfies Record<SegmentKind | 'running' | 'runningTrack', string>;
}

const BAR_DIMS = {
  card: { label: 11, labelWidth: 40, barHeight: 36, grid: false },
  full: { label: 13, labelWidth: 48, barHeight: 0, grid: true },
} as const;

interface TimelineBarProps {
  view: TimelineView;
  /**
   * true = ขอบขวาคือเวลาปัจจุบัน ป้ายเดินทุกวินาทีแบบเดียวกับ playhead ของเว็บ
   * false = กะย้อนหลังหรือเลยสุดช่วงที่เลือกแล้ว ป้ายแสดงเวลาสุดช่วงนิ่ง ๆ
   */
  live: boolean;
  /** คำนำหน้าบนป้าย เช่น "ตอนนี้" ไม่ส่งมาก็แสดงแค่เวลา */
  endPrefix?: string;
  size: 'card' | 'full';
  /** 1 = เห็นทั้งช่วง มากกว่า 1 = ขยายแล้วลากเลื่อนได้ */
  zoom?: number;
  selectedId?: number | null;
  /** ส่งมาเมื่อต้องการให้แตะเลือกช่วงได้ ได้ null เมื่อแตะโดนช่วงที่ไลน์เดินงาน */
  onSelect?: (segment: TimelineSegment | null) => void;
  /** ขนาดการ์ดสูงคงที่ ขนาดเต็มจอให้ส่ง { flex: 1 } เพื่อยืดเต็มความสูงที่เหลือ */
  style?: StyleProp<ViewStyle>;
}

/** แถบเวลาของกะ: ป้ายเวลา เส้นแบ่งชั่วโมง ช่วงหยุด/พัก และป้ายเวลาสุดช่วง */
export function TimelineBar({
  view,
  live,
  endPrefix,
  size,
  zoom = 1,
  selectedId = null,
  onSelect,
  style,
}: TimelineBarProps) {
  const { colors: c, isDark } = useTheme();
  const d = BAR_DIMS[size];
  const styles = useMemo(() => createBarStyles(c, size), [c, size]);
  const colors = useMemo(() => statusColors(c, isDark), [c, isDark]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  const prevZoom = useRef(zoom);
  /** ตำแหน่งที่รอเลื่อนไป หลัง ScrollView วัดความกว้างเนื้อหาใหม่เสร็จ */
  const pendingScrollX = useRef<number | null>(null);

  const width = viewport.width * zoom;
  const displayEnd = Math.max(view.end, view.start + MIN_RANGE_MS);
  const span = displayEnd - view.start;
  const toX = (ms: number) => ((ms - view.start) / span) * width;
  const endX = toX(view.end);
  const prefix = endPrefix ? `${endPrefix} ` : '';
  // กว้างตามรูปแบบ HH:MM:SS ที่ยาวคงที่ ป้ายจะได้ไม่ขยับซ้ายขวาทุกวินาที
  const pillWidth = Math.max(d.labelWidth + 8, (prefix.length + 8) * d.label * 0.62 + 16);

  /**
   * ซูมแล้วคงจุดที่กำลังดูไว้ ไม่ให้แถบกระโดดกลับไปต้นกะ เหมือนที่เว็บคงตำแหน่งตามเมาส์
   *
   * ถ้าก่อนซูมมองเห็นเวลาปัจจุบันอยู่ ให้ยึดขอบขวาไว้ที่ 80% ของจอ เพราะสิ่งที่ลีดเดอร์
   * อยากดูมักเป็นช่วงล่าสุด ถ้ายึดจุดกลางจอแทน กด + ซ้ำสองครั้งป้ายเวลาปัจจุบันจะหลุดออกนอกจอ
   * ส่วนกรณีที่เลื่อนไปดูช่วงอื่นอยู่แล้ว ค่อยยึดจุดกลางจอ
   */
  useLayoutEffect(() => {
    if (!viewport.width || prevZoom.current === zoom) return;
    const oldWidth = viewport.width * prevZoom.current;
    const oldEndX = (endX / width) * oldWidth;
    // เผื่อทศนิยม เวลาปัจจุบันอยู่ชิดขอบขวาพอดีจะได้ยังนับว่ามองเห็น
    const endWasVisible =
      oldEndX >= scrollX.current - 2 && oldEndX <= scrollX.current + viewport.width + 2;
    const anchorRatio = endWasVisible
      ? endX / width
      : (scrollX.current + viewport.width / 2) / oldWidth;
    const anchorOffset = endWasVisible ? viewport.width * 0.8 : viewport.width / 2;
    prevZoom.current = zoom;
    const x = Math.min(Math.max(0, anchorRatio * width - anchorOffset), width - viewport.width);
    // จำตำแหน่งไว้เองด้วย เพราะการเลื่อนด้วยโค้ดไม่รับประกันว่าจะมี onScroll ตามมา
    scrollX.current = x;
    // ยังเลื่อนตอนนี้ไม่ได้ ScrollView ต้องวัดความกว้างเนื้อหาใหม่ก่อน ไม่งั้นคำสั่งเลื่อนถูกทิ้งเงียบ ๆ
    // (ซูมจาก 1x คือ ScrollView เพิ่งถูกสร้างด้วย) จึงฝากไว้ให้ onContentSizeChange เลื่อนให้
    // ใช้ useLayoutEffect ให้ฝากไว้ทันก่อนเหตุการณ์นั้นมาถึง และตั้งเวลาเลื่อนซ้ำไว้กันพลาดอีกชั้น
    pendingScrollX.current = x;
    // ไม่ยกเลิกตัวจับเวลาตอน effect รันซ้ำ เพราะเวลาปัจจุบันขยับจะทำให้ effect รันซ้ำก่อนเลื่อนทัน
    setTimeout(() => scrollRef.current?.scrollTo({ x, animated: false }), 80);
  }, [zoom, viewport.width, width, endX]);

  const ticks = useMemo(() => {
    if (width <= 0) return [];
    const step = tickStep(span, width, d.labelWidth);
    const list: number[] = [];
    for (let at = view.start; at <= displayEnd; at += step) list.push(at);
    return list;
  }, [view.start, displayEnd, span, width, d.labelWidth]);

  const clampLeft = (x: number, w: number) => Math.min(Math.max(x - w / 2, 0), width - w);
  const pillLeft = clampLeft(endX, pillWidth);
  // ป้ายชั่วโมงที่ชนกับป้ายสุดช่วงถูกซ่อน ไม่งั้นตัวเลขทับกันอ่านไม่ออก
  const visibleTicks = ticks.filter((at) => {
    const left = clampLeft(toX(at), d.labelWidth);
    return left + d.labelWidth + 4 <= pillLeft || left >= pillLeft + pillWidth + 4;
  });

  /**
   * หาช่วงที่ถูกแตะ เลือกช่วงที่แคบที่สุดที่คลุมจุดนั้น เพราะช่วงสั้นมักซ้อนอยู่ในช่วงยาว
   * locationX อ้างอิงชั้นรับการแตะที่คลุมทั้งแถบ ชั้นสีด้านล่างปิดรับการแตะไว้
   * ไม่งั้น Android จะคืนตำแหน่งเทียบกับแถบสีที่แตะโดนแทน
   */
  function handlePress(e: GestureResponderEvent) {
    if (!onSelect || width <= 0) return;
    const at = view.start + (e.nativeEvent.locationX / width) * span;
    const slop = (TOUCH_SLOP_PX / width) * span;
    const hit = view.segments
      .filter((seg) => at >= seg.start - slop && at <= seg.end + slop)
      .sort((a, b) => a.end - a.start - (b.end - b.start))[0];
    onSelect(hit ?? null);
  }

  const selected = view.segments.find((seg) => seg.id === selectedId) ?? null;

  const content = (
    <View style={{ width, height: viewport.height }}>
      <View style={styles.ticks}>
        {visibleTicks.map((at) => (
          <Text
            key={at}
            style={[styles.tickLabel, { left: clampLeft(toX(at), d.labelWidth) }]}
            numberOfLines={1}>
            {hhmm(at)}
          </Text>
        ))}
        <View style={[styles.endPill, { left: pillLeft, width: pillWidth }]}>
          <Text style={styles.endPillText} numberOfLines={1}>
            {live ? <LiveClock prefix={prefix} /> : `${prefix}${hhmmss(view.end)}`}
          </Text>
        </View>
      </View>

      <View style={[styles.bar, { backgroundColor: colors.runningTrack }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {view.segments.map((seg) => {
            const left = toX(seg.start);
            return (
              <View
                key={seg.id}
                style={[
                  styles.segment,
                  {
                    left,
                    width: Math.max(MIN_SEGMENT_WIDTH, toX(seg.end) - left),
                    backgroundColor: colors[seg.kind],
                  },
                ]}
              />
            );
          })}

          {/* เส้นแบ่งเวลาวางทับช่วงหยุด ให้กะเวลาได้โดยไม่ต้องไล่สายตาขึ้นไปดูป้าย */}
          {d.grid &&
            ticks.slice(1).map((at) => (
              <View key={`grid-${at}`} style={[styles.gridLine, { left: toX(at) }]} />
            ))}

          {selected && (
            <View
              style={[
                styles.selected,
                {
                  left: toX(selected.start) - 2,
                  width: Math.max(6, toX(selected.end) - toX(selected.start) + 4),
                },
              ]}
            />
          )}
        </View>

        {onSelect && <Pressable style={StyleSheet.absoluteFill} onPress={handlePress} />}
      </View>

      <View style={[styles.endMarker, { left: Math.min(endX, width - 2) }]} pointerEvents="none" />
    </View>
  );

  return (
    <View
      style={[styles.root, style]}
      onLayout={(e: LayoutChangeEvent) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setViewport((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }}>
      {/*
        ใช้ ScrollView เฉพาะตอนซูม เพราะ ScrollView แนวนอนบน Android ดักการแตะไว้เอง
        แม้ห่อด้วย pointerEvents="none" แตะที่แถบบนการ์ดแล้วจึงไม่เปิดหน้าเต็มจอ
      */}
      {viewport.width > 0 && zoom > 1 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          onScroll={(e) => {
            scrollX.current = e.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={64}
          onContentSizeChange={() => {
            if (pendingScrollX.current === null) return;
            scrollRef.current?.scrollTo({ x: pendingScrollX.current, animated: false });
            pendingScrollX.current = null;
          }}
          style={StyleSheet.absoluteFill}>
          {content}
        </ScrollView>
      )}
      {viewport.width > 0 && zoom <= 1 && <View style={StyleSheet.absoluteFill}>{content}</View>}
    </View>
  );
}

interface CardProps {
  timeline: LineTimeline;
  line: string;
  isToday: boolean;
  /** แตะการ์ดเพื่อเปิดแบบเต็มจอ */
  onPress?: () => void;
}

/** การ์ดสรุปสถานะไลน์บนหน้ารายการ ใช้ช่วง "ทั้งวัน" ซึ่งเป็นค่าเริ่มต้นของเว็บ */
export default function LineStatusTimeline({ timeline, line, isToday, onPress }: CardProps) {
  const { colors: c, isDark } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createCardStyles(c), [c]);
  const colors = useMemo(() => statusColors(c, isDark), [c, isDark]);
  const now = useNow(isToday);
  const view = useMemo(() => viewTimeline(timeline, now, 24), [timeline, now]);

  const stopLabel = `${t('timelineStop')} ${Math.round(view.stopMins)}m`;
  const breakLabel = `${t('timelineBreak')} ${Math.round(view.breakMins)}m`;
  const live = isToday && view.end === now;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && onPress && styles.cardPressed]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={onPress ? t('timelineExpand') : undefined}
      accessibilityLabel={`${line} ${t('timelineTitle')}: ${stopLabel}, ${breakLabel}`}>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {line.toUpperCase()} · {t('timelineTitle')}
        </Text>
        {onPress && (
          <Text style={styles.expandHint} numberOfLines={1}>
            {t('timelineExpand')}
          </Text>
        )}
      </View>
      <View style={styles.legend}>
        <LegendItem color={colors.running} label={t('timelineRunning')} styles={styles} />
        <LegendItem color={colors.stop} label={stopLabel} styles={styles} />
        <LegendItem color={colors.break} label={breakLabel} styles={styles} />
      </View>

      {/* การ์ดแตะเพื่อเปิดเต็มจอ แถบในการ์ดจึงไม่รับการแตะเลือกช่วงเอง */}
      <View pointerEvents="none">
        <TimelineBar view={view} live={live} size="card" />
      </View>
    </Pressable>
  );
}

function LegendItem({
  color,
  label,
  styles,
}: {
  color: string;
  label: string;
  styles: ReturnType<typeof createCardStyles>;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const createBarStyles = (c: ThemeColors, size: 'card' | 'full') => {
  const d = BAR_DIMS[size];
  const tickRow = Math.round(d.label * 1.9);
  const barTop = tickRow + 6;
  const overhang = 4;
  return StyleSheet.create({
    root: size === 'card' ? { height: barTop + d.barHeight + overhang } : {},
    ticks: { position: 'absolute', top: 0, left: 0, right: 0, height: tickRow },
    tickLabel: {
      position: 'absolute',
      bottom: 2,
      width: d.labelWidth,
      textAlign: 'center',
      fontSize: d.label,
      fontVariant: ['tabular-nums'],
      color: c.textSecondary,
    },
    endPill: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      backgroundColor: c.primary,
    },
    endPillText: {
      fontSize: d.label,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      color: c.onPrimary,
    },
    bar: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: barTop,
      bottom: overhang,
      borderRadius: size === 'full' ? radius.md : radius.sm,
      overflow: 'hidden',
    },
    segment: { position: 'absolute', top: 0, bottom: 0 },
    gridLine: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: c.bg,
      opacity: 0.6,
    },
    /** กรอบรอบช่วงที่เลือก ใช้สีตัวอักษรหลักให้ตัดกับทั้งสีแดง เหลือง และเขียว */
    selected: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      borderWidth: 2,
      borderRadius: 3,
      borderColor: c.textPrimary,
    },
    endMarker: {
      position: 'absolute',
      top: tickRow,
      bottom: 0,
      width: 2,
      borderRadius: 1,
      backgroundColor: c.primary,
    },
  });
};

const createCardStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    cardPressed: { opacity: 0.85 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    title: {
      flexShrink: 1,
      fontSize: font.small,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: 0.5,
    },
    expandHint: { fontSize: font.small, fontWeight: '600', color: c.primary },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: spacing.md,
      rowGap: spacing.xs,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    legendDot: { width: 9, height: 9, borderRadius: 5 },
    legendText: { fontSize: font.small, fontWeight: '700', color: c.textSecondaryStrong },
  });

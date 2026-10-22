import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describeError } from '@/api/app-error';
import { fetchShiftData } from '@/api/idle-time-service';
import { addDays, getShiftDateString, shiftTimeOrder } from '@/api/idle-rules';
import type { LineTimeline } from '@/api/line-timeline';
import { readPendingPhoto } from '@/api/record-draft';
import { copyErrorText } from '@/components/error-alert';
import LineStatusFullscreen from '@/components/line-status-fullscreen';
import LineStatusTimeline from '@/components/line-status-timeline';
import LineTabs from '@/components/line-tabs';
import MonthCalendar from '@/components/month-calendar';
import NewDataBanner from '@/components/new-data-banner';
import SearchField from '@/components/search-field';
import RecordCard from '@/components/record-card';
import WorkOrderGroup from '@/components/work-order-group';
import { controlHeight, elevation, font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useColors } from '@/context/theme-context';
import { useNewRecordAlert } from '@/hooks/use-new-record-alert';
import type { IdleTimeRecord } from '@/types';

interface WorkOrderSummary {
  workOrder: string;
  modelSuffix: string;
  records: IdleTimeRecord[];
  totalMins: number;
  pendingCount: number;
  /** เวลาเริ่มของรายการแรกในกลุ่ม */
  startTime: string;
  /** เวลาจบของรายการสุดท้ายในกลุ่ม */
  endTime: string;
}

const LINES = ['Line1', 'Line2'];

export default function DashboardScreen() {
  const router = useRouter();
  const c = useColors();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(c), [c]);
  // กะเริ่ม 08:00 ถ้าเปิดแอปก่อน 8 โมงยังถือเป็นกะของเมื่อวาน
  const [today] = useState(getShiftDateString);
  const [shiftDate, setShiftDate] = useState(today);
  const isToday = shiftDate === today;
  /** เปิดปฏิทินเมื่อแตะที่วันที่ ใช้เลือกวันย้อนหลังไกล ๆ โดยไม่ต้องกดลูกศรทีละวัน */
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedLine, setSelectedLine] = useState(LINES[0]);
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<IdleTimeRecord[]>([]);
  /**
   * แถบสถานะไลน์ ผูก key ของไลน์และวันที่ไว้ด้วย
   * ตอนสลับไลน์หรือวัน ข้อมูลใหม่ยังโหลดไม่เสร็จ ห้ามแสดงแถบของไลน์เดิมค้างไว้ใต้ชื่อไลน์ใหม่
   */
  const [timeline, setTimeline] = useState<{ key: string; data: LineTimeline } | null>(null);
  const timelineKey = `${selectedLine}|${shiftDate}`;
  /** เปิดแถบสถานะแบบเต็มจอแนวนอน */
  const [timelineFullscreen, setTimelineFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // กาง work order ได้ทีละใบ ให้โฟกัสอยู่กับใบที่กำลังดู
  const [expanded, setExpanded] = useState<string | null>(null);
  const listRef = useRef<FlatList<WorkOrderSummary>>(null);

  /** ส่งเป็น prop ให้การ์ดทุกใบ ต้องเป็นตัวเดิมทุกเรนเดอร์ ไม่งั้น memo ของการ์ดไม่มีผล */
  const openDetail = useCallback(
    (record: IdleTimeRecord) =>
      router.push({ pathname: '/record/[id]', params: { id: record.id, date: shiftDate } }),
    [router, shiftDate]
  );

  /** ดึงข้อมูลกะครั้งเดียว ได้ทั้งรายการที่ต้องกรอกสาเหตุและแถบสถานะไลน์ */
  const fetchShift = useCallback(async () => {
    const { records: fresh, timeline: line } = await fetchShiftData({
      line: selectedLine,
      date: shiftDate,
    });
    setTimeline(line ? { key: `${selectedLine}|${shiftDate}`, data: line } : null);
    return fresh;
  }, [selectedLine, shiftDate]);

  const load = useCallback(async () => {
    const fresh = await fetchShift();
    setRecords(fresh);
    return fresh;
  }, [fetchShift]);

  const { userName } = useAuth();

  /**
   * แอปถูก Android ปิดไประหว่างถ่ายรูปในหน้ากรอกสาเหตุ พอเปิดใหม่จะเริ่มที่หน้านี้
   * พากลับไปหน้ารายการเดิมให้เอง ร่างที่กรอกและรูปที่ถ่ายไว้จะถูกกู้คืนที่นั่น
   * ไม่งั้นลีดเดอร์ต้องจำเองว่าค้างรายการไหน ส่วนใหญ่จะไม่รู้ว่ามีของค้างอยู่
   */
  useEffect(() => {
    void readPendingPhoto().then((target) => {
      if (target) {
        router.push({ pathname: '/record/[id]', params: { id: target.id, date: target.date } });
      }
    });
    // ทำครั้งเดียวตอนเปิดแอป
  }, []);

  /**
   * ดึงรายการล่าสุดของกะที่ดูอยู่ ให้ hook เอาไปเทียบหาว่ามีอะไรใหม่
   * แถบสถานะไลน์อัปเดตไปในรอบเดียวกัน การหยุดสั้นที่ไม่ขึ้นในรายการจึงยังโผล่บนแถบ
   */
  const fetchLatest = fetchShift;

  const buildMessage = useCallback(
    (count: number) => ({
      title: t('newRecordsTitle'),
      body: t('newRecordsBody').replace('{count}', String(count)),
    }),
    [t]
  );

  const { newCount, dismiss, resetBaseline } = useNewRecordAlert({
    fetchLatest,
    userName,
    // แจ้งเตือนเฉพาะกะปัจจุบัน ย้อนดูวันเก่าไม่ต้องเด้ง
    enabled: isToday,
    buildMessage,
  });

  /**
   * พอรู้ว่ามีรายการใหม่ ก็โหลดมาแสดงเองเลย ไม่ต้องรอผู้ใช้กดแถบสีน้ำเงิน
   *
   * ไม่หมุนวงกลมของ pull-to-refresh เพราะผู้ใช้ไม่ได้เป็นคนสั่ง การเห็นวงหมุน
   * โผล่มาเองจะดูเหมือนแอปค้าง ปล่อยให้แถบสีน้ำเงินเป็นตัวบอกว่ากำลังมีของใหม่
   * แล้วแถบจะหายไปเองเมื่อ resetBaseline ทำงานหลังโหลดเสร็จ
   *
   * ไม่วนซ้ำ เพราะ resetBaseline ตั้ง newCount กลับเป็น 0 แล้ว effect รอบถัดไป
   * จะออกตั้งแต่บรรทัดแรก
   *
   * ทำแบบนี้ได้เพราะรายการถูกกรองให้เหลือเฉพาะที่หยุดเกิน 1 นาทีแล้ว ของใหม่
   * จึงเข้ามาห่างกันพอที่ลิสต์จะไม่ขยับใส่ตอนผู้ใช้กำลังจะกดรายการอื่น
   */
  useEffect(() => {
    if (newCount === 0) return;
    load()
      .then(resetBaseline)
      .catch(() => {
        // โหลดไม่สำเร็จไม่ต้องขึ้น error เพราะผู้ใช้ไม่ได้เป็นคนสั่ง
        // แถบสีน้ำเงินยังค้างอยู่ ผู้ใช้กดเองได้ถ้าอยากลองใหม่
      });
  }, [newCount, load, resetBaseline]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setError(null);
      load()
        .then(resetBaseline)
        .catch((e) => setError(`${t('loadFailed')}\n${describeError(e, t)}`))
        .finally(() => setLoading(false));
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      resetBaseline(await load());
    } catch (e) {
      setError(`${t('loadFailed')}\n${describeError(e, t)}`);
    } finally {
      setRefreshing(false);
    }
  }

  const keyword = search.toLowerCase();
  const filtered = useMemo(
    () =>
      records.filter(
        (r) =>
          !keyword ||
          r.workOrder.toLowerCase().includes(keyword) ||
          r.modelSuffix.toLowerCase().includes(keyword)
      ),
    [records, keyword]
  );

  /** นับจากรายการทั้งกะ ไม่ใช่ที่ค้นเจอ ตัวเลขจะได้ไม่ลดลงตอนพิมพ์ค้นหา */
  const pendingTotal = useMemo(() => records.filter((r) => !r.idleTimeIssue).length, [records]);

  /**
   * เปิดหรือปิดกลุ่ม พร้อมเลื่อนกลุ่มที่เพิ่งเปิดขึ้นไปบนสุด
   *
   * ถ้าไม่เลื่อนให้ กลุ่มที่อยู่ค่อนไปทางล่างจอจะกางรายการย่อยออกไปใต้ขอบจอ
   * ผู้ใช้กดแล้วเหมือนไม่มีอะไรเกิดขึ้น ต้องเลื่อนหาเอง
   *
   * หน่วงหนึ่งเฟรมก่อนเลื่อน เพราะต้องรอให้รายการย่อยถูกวางลงจอก่อน
   * ไม่งั้นจะคำนวณตำแหน่งจากความสูงเดิมที่ยังไม่รวมรายการย่อย
   */
  function toggleGroup(workOrder: string, index: number) {
    const willOpen = expanded !== workOrder;
    setExpanded(willOpen ? workOrder : null);
    if (!willOpen) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, viewPosition: 0, animated: true });
    });
  }

  /** จัดรายการเป็นกลุ่มตาม work order พร้อมสรุปยอดของแต่ละใบ */
  const groups = useMemo(() => {
    const byWorkOrder = new Map<string, WorkOrderSummary>();
    for (const r of filtered) {
      let g = byWorkOrder.get(r.workOrder);
      if (!g) {
        g = {
          workOrder: r.workOrder,
          modelSuffix: r.modelSuffix,
          records: [],
          totalMins: 0,
          pendingCount: 0,
          startTime: r.startTime,
          endTime: r.endTime,
        };
        byWorkOrder.set(r.workOrder, g);
      }
      g.records.push(r);
      g.totalMins += r.totalMins;
      if (!r.idleTimeIssue) g.pendingCount += 1;
      // เทียบด้วยลำดับในกะ ไม่ใช่สตริง เพื่อให้กะที่ข้ามเที่ยงคืนเรียงถูก
      if (shiftTimeOrder(r.startTime) < shiftTimeOrder(g.startTime)) g.startTime = r.startTime;
      if (shiftTimeOrder(r.endTime) > shiftTimeOrder(g.endTime)) g.endTime = r.endTime;
    }
    const groups = [...byWorkOrder.values()];
    /**
     * ในกลุ่มเรียงตามเวลาที่เกิดจริง (เช้าก่อน) แล้วนับ 1..n ใหม่บนการ์ดย่อย
     * เลข no เป็นลำดับของทั้งกะ ถ้าใช้ตรง ๆ กลุ่มจะเริ่มที่ #2 หรือเลขกระโดด ทำให้พนักงานงง
     */
    for (const g of groups) {
      g.records.sort((a, b) => shiftTimeOrder(a.startTime) - shiftTimeOrder(b.startTime));
    }
    return groups;
  }, [filtered]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateNav}
            onPress={() => setShiftDate((d) => addDays(d, -1))}
            hitSlop={spacing.sm}>
            <Text style={styles.dateNavText}>◀</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateCenter}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}>
            <Text style={styles.headerTitle}>{shiftDate}</Text>
            <Text style={styles.dateHint}>{isToday ? t('shiftToday') : t('shiftPast')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateNav, isToday && styles.dateNavDisabled]}
            onPress={() => setShiftDate((d) => addDays(d, 1))}
            disabled={isToday}
            hitSlop={spacing.sm}>
            <Text style={styles.dateNavText}>▶</Text>
          </TouchableOpacity>
        </View>

        {!isToday && (
          <TouchableOpacity style={styles.todayButton} onPress={() => setShiftDate(today)}>
            <Text style={styles.todayButtonText}>{t('backToToday')}</Text>
          </TouchableOpacity>
        )}

        {/* เลือกวันย้อนหลังได้ไกลตามต้องการ แต่เลือกอนาคตไม่ได้ เพราะกะที่ยังไม่เกิดย่อมไม่มีรายการ */}
        <MonthCalendar
          visible={showDatePicker}
          value={shiftDate}
          maxDate={today}
          onSelect={setShiftDate}
          onClose={() => setShowDatePicker(false)}
        />

        {/* เลือกไลน์ก่อน แล้วการ์ดสถานะกับรายการด้านล่างจึงเป็นของไลน์นั้น */}
        <View style={styles.tabsWrap}>
          <LineTabs lines={LINES} selected={selectedLine} onSelect={setSelectedLine} />
        </View>
      </View>

      {/* แตะแถบ error เพื่อคัดลอกข้อความทั้งก้อนไปแจ้ง IT เหมือนปุ่ม "คัดลอก" ในกล่องแจ้งเตือน */}
      {error && (
        <TouchableOpacity
          onPress={() => void copyErrorText(error, t)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityHint={t('tapToCopyError')}>
          <Text style={styles.error}>
            ⚠ {error}
            {'\n\n'}
            <Text style={styles.errorHint}>⧉ {t('tapToCopyError')}</Text>
          </Text>
        </TouchableOpacity>
      )}

      <NewDataBanner
        count={newCount}
        onPress={() => {
          dismiss();
          void onRefresh();
        }}
      />

      {timeline?.key === timelineKey && (
        <>
          <LineStatusTimeline
            timeline={timeline.data}
            line={selectedLine}
            isToday={isToday}
            onPress={() => setTimelineFullscreen(true)}
          />
        </>
      )}

      {/*
        อยู่นอกเงื่อนไขด้านบน เพราะสลับไลน์จากในหน้าเต็มจอได้
        ระหว่างข้อมูลไลน์ใหม่ยังไม่มา หน้าเต็มจอต้องเปิดค้างพร้อมตัวโหลด ไม่ใช่ปิดตัวเองไป
        ข้อมูลยังอัปเดตตามรอบ poll ระหว่างเปิดเต็มจอ เพราะรับ timeline ชุดเดียวกับการ์ด
      */}
      <LineStatusFullscreen
        visible={timelineFullscreen}
        onClose={() => setTimelineFullscreen(false)}
        timeline={timeline?.key === timelineKey ? timeline.data : null}
        loading={loading}
        lines={LINES}
        line={selectedLine}
        onLineChange={setSelectedLine}
        date={shiftDate}
        isToday={isToday}
      />

      <View style={styles.searchWrap}>
        {/*
          สรุปทั้งกะ ไม่ขึ้นกับคำค้นหา ลีดเดอร์รู้ได้ทันทีว่ายังเหลืองานกี่รายการ
          โดยไม่ต้องเลื่อนนับการ์ดแดงเอง ซ่อนระหว่างโหลดไม่ให้เห็นเลข 0 หลอก ๆ
        */}
        {!loading && records.length > 0 && (
          <View style={styles.summaryRow}>
            <View
              style={[
                styles.summaryChip,
                pendingTotal > 0 ? styles.summaryChipPending : styles.summaryChipDone,
              ]}>
              <Text style={styles.summaryChipText}>
                {pendingTotal > 0 ? `${pendingTotal} ${t('pendingCount')}` : t('allDone')}
              </Text>
            </View>
            <Text style={styles.summaryText}>
              {t('summaryTotal').replace('{count}', String(records.length))}
            </Text>
          </View>
        )}
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder={t('searchPlaceholder')}
          clearLabel={t('clearSearch')}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={c.primary} />
      ) : (
        <FlatList
          ref={listRef}
          data={groups}
          keyExtractor={(g) => g.workOrder}
          renderItem={({ item: g, index }) => {
            /*
              work order ที่มีรายการเดียวไม่ต้องทำเป็นกลุ่ม
              เพราะหัวกลุ่มจะบอกข้อมูลซ้ำกับการ์ดข้างในทั้งหมด และยังต้องกดเปิดอีกหนึ่งครั้ง
              กว่าจะเห็นรายการ กลายเป็นเพิ่มขั้นตอนโดยไม่ได้ช่วยจัดระเบียบอะไร
            */
            if (g.records.length < 2) {
              return <RecordCard record={g.records[0]} onPress={openDetail} />;
            }

            const isOpen = expanded === g.workOrder;
            return (
              <View>
                <WorkOrderGroup
                  workOrder={g.workOrder}
                  modelSuffix={g.modelSuffix}
                  count={g.records.length}
                  startTime={g.startTime}
                  endTime={g.endTime}
                  totalMins={g.totalMins}
                  pendingCount={g.pendingCount}
                  expanded={isOpen}
                  onToggle={() => toggleGroup(g.workOrder, index)}
                />
                {isOpen && (
                  <View
                    style={[
                      styles.groupChildren,
                      g.pendingCount > 0
                        ? { borderColor: c.danger, borderLeftColor: c.statusPendingFill }
                        : { borderLeftColor: c.statusDoneFill },
                    ]}>
                    <Text style={styles.groupChildrenLabel}>
                      {t('subItems')} · {g.records.length}
                    </Text>
                    {g.records.map((r, i) => (
                      <RecordCard key={r.id} record={r} onPress={openDetail} positionInGroup={i + 1} />
                    ))}
                  </View>
                )}
              </View>
            );
          }}
          /* เผื่อความสูงแถบนำทางด้านล่าง ให้การ์ดใบสุดท้ายเลื่อนขึ้นมาพ้นปุ่มนำทางได้ */
          contentContainerStyle={{
            paddingTop: spacing.sm,
            paddingBottom: spacing.xl + insets.bottom,
          }}
          /*
            จำนวนแถวที่วาดล่วงหน้า ตั้งให้พอดีกับที่เห็นบนจอจริงราว 4-5 ใบ
            ไม่ใช้ removeClippedSubviews เพราะบน Android ทำให้การ์ดกลายเป็นช่องว่างเป็นครั้งคราว
            ซึ่งหน้างานอ่านผิดได้ว่าไม่มีรายการ อันตรายกว่าที่จะได้ความเร็วเพิ่มเล็กน้อย
          */
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('emptyList')}</Text>}
          /*
            การ์ดแต่ละใบสูงไม่เท่ากัน FlatList จึงกระโดดไปตำแหน่งที่ยังไม่ได้วัดไม่ได้
            กรณีนั้นให้เลื่อนแบบประมาณก่อนแล้วค่อยกระโดดซ้ำอีกครั้งเมื่อวัดเสร็จ
          */
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            listRef.current?.scrollToOffset({
              offset: index * averageItemLength,
              animated: true,
            });
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index, viewPosition: 0, animated: true });
            }, 120);
          }}
        />
      )}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerTitle: { fontSize: font.h1, fontWeight: '700', color: c.textPrimary, letterSpacing: 0.5 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateCenter: { alignItems: 'center' },
  dateHint: { fontSize: font.small, color: c.textSecondary, marginTop: spacing.xs },
  dateNav: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    ...elevation.card,
  },
  dateNavDisabled: { opacity: 0.3, shadowOpacity: 0, elevation: 0 },
  dateNavText: { color: c.primary, fontSize: font.body, lineHeight: font.body + 6 },
  /** ทำเป็นชิปแทนข้อความเปล่า ให้เห็นชัดว่ากดได้ */
  todayButton: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: c.chipBg,
  },
  todayButtonText: { color: c.primary, fontSize: font.small, fontWeight: '700' },
  tabsWrap: { marginTop: spacing.md },
  searchWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  summaryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  summaryChipPending: { backgroundColor: c.statusPendingFill },
  summaryChipDone: { backgroundColor: c.statusDoneFill },
  summaryChipText: { fontSize: font.small, fontWeight: '800', color: c.onStatus },
  summaryText: { fontSize: font.small, fontWeight: '600', color: c.textSecondaryStrong },
  /**
   * ถาดที่ต่อกรอบลงมาจากหัวกลุ่ม ครอบรายการย่อยทั้งหมดไว้ข้างใน
   * พื้นถาดใช้สีพื้นจอ ซึ่งต่างจากทั้งหัวกลุ่มและการ์ดย่อย จึงเห็นเป็นสามชั้นชัดเจน
   * พนักงานจะได้ไม่เข้าใจผิดว่าการ์ดย่อยเป็น work order ใบใหม่
   * เว้นระยะท้ายถาดให้ห่างจาก work order ใบถัดไปมากกว่าระยะระหว่างการ์ดปกติ
   */
  groupChildren: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: c.border,
    borderLeftWidth: 6,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
  },
  groupChildrenLabel: {
    fontSize: font.small,
    fontWeight: '700',
    color: c.textSecondary,
    marginBottom: spacing.sm,
  },
  empty: {
    textAlign: 'center',
    color: c.textSecondary,
    fontSize: font.body,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  error: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.danger,
    backgroundColor: c.dangerBg,
    color: c.danger,
    fontSize: font.small,
  },
  errorHint: { fontWeight: '700', textDecorationLine: 'underline' },
});

import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { fetchRecords } from '@/api/idle-time-service';
import { addDays, getShiftDateString } from '@/api/idle-rules';
import LineTabs from '@/components/line-tabs';
import NewDataBanner from '@/components/new-data-banner';
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
}

const LINES = ['Line1', 'Line2'];

export default function DashboardScreen() {
  const router = useRouter();
  const c = useColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(c), [c]);
  // กะเริ่ม 08:00 ถ้าเปิดแอปก่อน 8 โมงยังถือเป็นกะของเมื่อวาน
  const [today] = useState(getShiftDateString);
  const [shiftDate, setShiftDate] = useState(today);
  const isToday = shiftDate === today;
  const [selectedLine, setSelectedLine] = useState(LINES[0]);
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<IdleTimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // กาง work order ได้ทีละใบ ให้โฟกัสอยู่กับใบที่กำลังดู
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const fresh = await fetchRecords({ line: selectedLine, date: shiftDate });
    setRecords(fresh);
    return fresh;
  }, [selectedLine, shiftDate]);

  const { userName } = useAuth();

  /** ดึงรายการล่าสุดของกะที่ดูอยู่ ให้ hook เอาไปเทียบหาว่ามีอะไรใหม่ */
  const fetchLatest = useCallback(
    () => fetchRecords({ line: selectedLine, date: shiftDate }),
    [selectedLine, shiftDate]
  );

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

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setError(null);
      load()
        .then(resetBaseline)
        .catch((e) => setError(e instanceof Error ? e.message : t('loadFailed')))
        .finally(() => setLoading(false));
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      resetBaseline(await load());
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadFailed'));
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
        };
        byWorkOrder.set(r.workOrder, g);
      }
      g.records.push(r);
      g.totalMins += r.totalMins;
      if (!r.idleTimeIssue) g.pendingCount += 1;
    }
    return [...byWorkOrder.values()];
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

          <View style={styles.dateCenter}>
            <Text style={styles.headerTitle}>{shiftDate}</Text>
            <Text style={styles.dateHint}>{isToday ? t('shiftToday') : t('shiftPast')}</Text>
          </View>

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
      </View>

      {error && <Text style={styles.error}>⚠ {error}</Text>}

      <NewDataBanner
        count={newCount}
        onPress={() => {
          dismiss();
          void onRefresh();
        }}
      />

      <LineTabs lines={LINES} selected={selectedLine} onSelect={setSelectedLine} />

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          {/* แว่นขยายวาดเองด้วย View ตามแนวทางไอคอนอื่นในแอป */}
          <View style={styles.searchIcon}>
            <View style={styles.searchLens} />
            <View style={styles.searchHandle} />
          </View>
          <TextInput
            style={styles.search}
            placeholder={t('searchPlaceholder')}
            placeholderTextColor={c.textSecondary}
            value={search}
            onChangeText={setSearch}
            // work order เป็นรหัสตัวพิมพ์ใหญ่ผสมตัวเลข ปิด autocorrect ไม่ให้แก้คำมั่ว
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={c.primary} />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.workOrder}
          renderItem={({ item: g }) => {
            const isOpen = expanded === g.workOrder;
            return (
              <View>
                <WorkOrderGroup
                  workOrder={g.workOrder}
                  modelSuffix={g.modelSuffix}
                  count={g.records.length}
                  totalMins={g.totalMins}
                  pendingCount={g.pendingCount}
                  expanded={isOpen}
                  onToggle={() => setExpanded(isOpen ? null : g.workOrder)}
                />
                {isOpen && (
                  <View
                    style={[
                      styles.groupChildren,
                      { borderLeftColor: g.pendingCount > 0 ? c.danger : c.success },
                    ]}>
                    {g.records.map((r) => (
                      <RecordCard
                        key={r.id}
                        record={r}
                        onPress={() =>
                          router.push({
                            pathname: '/record/[id]',
                            params: { id: r.id, date: shiftDate },
                          })
                        }
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          }}
          contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={styles.empty}>{t('emptyList')}</Text>}
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
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
  searchWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: controlHeight,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchIcon: { width: 20, height: 20, marginRight: spacing.sm },
  searchLens: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: c.textSecondary,
  },
  searchHandle: {
    position: 'absolute',
    right: 1,
    bottom: 2,
    width: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: c.textSecondary,
    transform: [{ rotate: '45deg' }],
  },
  search: { flex: 1, paddingVertical: spacing.sm, fontSize: font.body, color: c.textPrimary },
  /**
   * เส้นแนวตั้งด้านซ้ายลากจากหัวข้อกลุ่มลงมาคลุมรายการย่อย ทำให้เห็นชัดว่าอยู่ในกลุ่มเดียวกัน
   * และเว้นระยะท้ายบล็อกให้ห่างจาก work order ใบถัดไปมากกว่าระยะระหว่างการ์ดปกติ
   */
  groupChildren: {
    marginLeft: spacing.xl,
    marginBottom: spacing.xxl,
    borderLeftWidth: 3,
    paddingTop: spacing.md,
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
});

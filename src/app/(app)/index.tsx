/**
 * หน้ารายการ "ไลน์หยุด" ของกะ (หน้าแรกหลังล็อกอิน)
 *
 * @purpose        ให้ลีดเดอร์เห็นรายการหยุดของไลน์และวันที่เลือก แล้วแตะเข้าไปกรอกสาเหตุ
 * @input          วันที่กะ + ไลน์ที่เลือก → fetchShiftData (รายการ + แถบสถานะไลน์)
 * @output         แถบบน (วันที่, dropdown ไลน์) · การ์ดสถานะไลน์ · ตัวกรอง ทั้งหมด/ระบุแล้ว/รอระบุ ·
 *                 รายการแบบแถว จัดกลุ่มตาม Work Order
 * @behavior       ตรวจรายการใหม่ทุก 30 วินาที (useNewRecordAlert) แล้วโหลดให้เอง ·
 *                 กลับไปหน้ากรอกสาเหตุเดิมถ้าแอปถูกปิดระหว่างถ่ายรูป · กางกลุ่มแล้วเลื่อนกลุ่มขึ้นบนสุด
 * @dependency     src/api/idle-time-service.ts, src/hooks/use-new-record-alert.ts, src/components/line-*
 * @edit           หน้าตาแถว → RecordRow / GroupRow / TimeBlock ในไฟล์นี้ · ข้อความ → i18n.ts
 * @do-not-change  ตัวเลขบนตัวกรองนับจากทั้งกะ ไม่ขึ้นกับคำค้นหา · โหลดไม่สำเร็จต้องแสดง error ไม่ใช่รายการว่าง
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { describeError } from '@/api/app-error';
import { fetchShiftData } from '@/api/idle-time-service';
import { addDays, getShiftDateString, shiftTimeOrder } from '@/api/idle-rules';
import type { LineTimeline } from '@/api/line-timeline';
import { fetchPresence, subscribePresence } from '@/api/presence';
import { readPendingPhoto } from '@/api/record-draft';
import { copyErrorText } from '@/components/error-alert';
import {
  CalendarCheckIcon,
  CalendarDaysIcon,
  ChartColumnIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CircleXIcon,
  SortIcon,
} from '@/components/icons';
import LinePicker, { OptionSheet } from '@/components/line-picker';
import LineStatusFullscreen from '@/components/line-status-fullscreen';
import LineStatusTimeline from '@/components/line-status-timeline';
import MonthCalendar from '@/components/month-calendar';
import NewDataBanner from '@/components/new-data-banner';
import SearchField from '@/components/search-field';
import type { Language, TranslationKey } from '@/constants/i18n';
import { controlHeight, font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useColors, useTheme } from '@/context/theme-context';
import { useNewRecordAlert } from '@/hooks/use-new-record-alert';
import { BREAK_TIME_VALUE, type IdleTimeRecord } from '@/types';

const LINES = ['Line1', 'Line2'];

/** เริ่มที่ทั้งหมดเสมอ แล้วค่อยเลือกดูเฉพาะที่ระบุแล้วหรือที่ยังค้าง */
type Filter = 'all' | 'done' | 'pending';

/** ชื่อวัน/เดือนแบบย่อสำหรับวันที่บนแถบบน (ข้อมูลรูปแบบวันที่ แบบเดียวกับ month-calendar.tsx) */
const SHORT_DATE: Record<Language, { weekdays: string[]; months: string[] }> = {
  th: {
    weekdays: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'],
    months: [
      'ม.ค.',
      'ก.พ.',
      'มี.ค.',
      'เม.ย.',
      'พ.ค.',
      'มิ.ย.',
      'ก.ค.',
      'ส.ค.',
      'ก.ย.',
      'ต.ค.',
      'พ.ย.',
      'ธ.ค.',
    ],
  },
  en: {
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
  ko: {
    weekdays: ['일', '월', '화', '수', '목', '금', '토'],
    months: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  },
};

interface Group {
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

/** "2026-11-09" → "จ. 9 พ.ย." อ่านเร็วกว่ารูปแบบ ISO สำหรับคนหน้างาน */
function shortDate(dateString: string, language: Language) {
  const [y, m, d] = dateString.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  const { weekdays, months } = SHORT_DATE[language];
  // ภาษาเกาหลีเรียงเดือน-วัน-วันในสัปดาห์ เช่น 11월 9일 (월)
  if (language === 'ko') return `${months[m - 1]} ${d}일 (${weekdays[weekday]})`;
  return `${weekdays[weekday]} ${d} ${months[m - 1]}`;
}

/**
 * ช่วงพักไม่ใช่ปัญหาการผลิต จึงไม่ใช้สีเขียวปนกับรายการที่แก้ปัญหาจริงไปแล้ว
 * ยึดข้อความในช่องสาเหตุเป็นตัวชี้ขาด เหมือนที่ฝั่งเว็บใช้จัดกลุ่มในรายงาน
 */
function statusOf(r: IdleTimeRecord) {
  if (r.idleTimeIssue === BREAK_TIME_VALUE) return 'break' as const;
  return r.idleTimeIssue ? ('done' as const) : ('pending' as const);
}

export default function DashboardScreen() {
  const router = useRouter();
  const c = useColors();
  const { isDark } = useTheme();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);

  // กะเริ่ม 08:00 ถ้าเปิดแอปก่อน 8 โมงยังถือเป็นกะของเมื่อวาน
  const [today, setToday] = useState(getShiftDateString);
  const [shiftDate, setShiftDate] = useState(today);
  const isToday = shiftDate === today;
  /**
   * "วันนี้" ต้องอัปเดตเองเมื่อข้ามเวลา 08:00 เดิมคำนวณครั้งเดียวตอนเปิดหน้า
   * เครื่องที่เปิดแอปค้างไว้ข้ามกะจึงติดอยู่ที่กะเมื่อวาน เลือกวันนี้ไม่ได้ (พบ 2026-11-10)
   * ตรวจทุกนาทีและทุกครั้งที่กลับเข้าแอป ถ้ากำลังดูกะปัจจุบันอยู่ ให้เลื่อนไปกะใหม่ตามด้วย
   * ถ้ากำลังดูวันย้อนหลังอยู่ ไม่เปลี่ยนวันที่ดูให้
   */
  const todayRef = useRef(today);
  useEffect(() => {
    const refresh = () => {
      const next = getShiftDateString();
      const prev = todayRef.current;
      if (next === prev) return;
      todayRef.current = next;
      setToday(next);
      setShiftDate((cur) => (cur === prev ? next : cur));
    };
    const timer = setInterval(refresh, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  /** เปิดปฏิทินเมื่อแตะที่วันที่ ใช้เลือกวันย้อนหลังไกล ๆ โดยไม่ต้องกดลูกศรทีละวัน */
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedLine, setSelectedLine] = useState(LINES[0]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  /** ลำดับรายการ ค่าเริ่มต้นล่าสุดก่อน ตรงกับลำดับเดิมก่อนมีปุ่มนี้ */
  const [sort, setSort] = useState<SortKey>('latest');
  const [sortOpen, setSortOpen] = useState(false);
  const [records, setRecords] = useState<IdleTimeRecord[]>([]);
  /**
   * แถบสถานะไลน์ ผูก key ของไลน์และวันที่ไว้ด้วย
   * ตอนสลับไลน์หรือวัน ข้อมูลใหม่ยังโหลดไม่เสร็จ ห้ามแสดงแถบของไลน์เดิมค้างไว้ใต้ชื่อไลน์ใหม่
   */
  const [timeline, setTimeline] = useState<{ key: string; data: LineTimeline } | null>(null);
  const timelineKey = `${selectedLine}|${shiftDate}`;
  const [timelineFullscreen, setTimelineFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // กาง work order ได้ทีละใบ ให้โฟกัสอยู่กับใบที่กำลังดู
  const [expanded, setExpanded] = useState<string | null>(null);
  const listRef = useRef<FlatList<Group>>(null);

  /** ส่งเป็น prop ให้แถวทุกแถว ต้องเป็นตัวเดิมทุกเรนเดอร์ ไม่งั้น memo ของแถวไม่มีผล */
  const openDetail = useCallback(
    (record: IdleTimeRecord) =>
      router.push({ pathname: '/record/[id]', params: { id: record.id, date: shiftDate } }),
    [router, shiftDate],
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

  const buildMessage = useCallback(
    (count: number) => ({
      title: t('newRecordsTitle'),
      body: t('newRecordsBody').replace('{count}', String(count)),
    }),
    [t],
  );

  /**
   * ดึงรายการล่าสุดของกะที่ดูอยู่ ให้ hook เอาไปเทียบหาว่ามีอะไรใหม่
   * แถบสถานะไลน์อัปเดตไปในรอบเดียวกัน การหยุดสั้นที่ไม่ขึ้นในรายการจึงยังโผล่บนแถบ
   */
  const { newCount, dismiss, resetBaseline } = useNewRecordAlert({
    fetchLatest: fetchShift,
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

  /**
   * ใครกำลังกรอกรายการไหนอยู่ (recordId → ชื่อ) ถามทุก 15 วินาทีเฉพาะตอนหน้านี้อยู่บนจอ
   * ออกไปหน้ากรอกแล้วหยุดถาม ไม่ให้หน้าที่อยู่ข้างหลังแย่งเน็ตกับเครื่องตอนกำลังพิมพ์
   * ติดต่อไม่ได้ให้ล้างป้ายทิ้ง ป้ายเก่าที่ค้างจะทำให้เข้าใจผิดว่ายังมีคนกรอกอยู่
   */
  const [editing, setEditing] = useState<Map<string, string>>(() => new Map());
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // เทียบก่อนตั้งค่า ไม่ให้ทั้งรายการวาดใหม่ทั้งที่ไม่มีอะไรเปลี่ยน
      const apply = (next: Map<string, string>) => {
        if (cancelled) return;
        setEditing((prev) =>
          prev.size === next.size && [...next].every(([k, v]) => prev.get(k) === v) ? prev : next,
        );
      };
      /*
        เรียลไทม์ผ่าน WebSocket: ป้ายขึ้น/หายภายในไม่ถึงวินาที (ผู้ใช้ขอ 2026-11-10)
        ยังถามทุก 15 วินาทีไว้ด้วย เป็นตัวสำรองตอนท่อหลุดหรือ server รุ่นเก่ายังไม่มีท่อนี้
      */
      const unsubscribe = subscribePresence(shiftDate, apply);
      const poll = async () => {
        const next = await fetchPresence(shiftDate);
        // ติดต่อไม่ได้ให้ล้างป้ายทิ้ง ป้ายเก่าที่ค้างจะทำให้เข้าใจผิดว่ายังมีคนกรอกอยู่
        apply(next ?? new Map<string, string>());
      };
      void poll();
      const timer = setInterval(() => void poll(), PRESENCE_POLL_MS);
      return () => {
        cancelled = true;
        clearInterval(timer);
        unsubscribe();
      };
    }, [shiftDate]),
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setError(null);
      load()
        .then(resetBaseline)
        .catch((e) => setError(`${t('loadFailed')}\n${describeError(e, t)}`))
        .finally(() => setLoading(false));
    }, [load]),
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
    const keyword = search.toLowerCase();
    const byWorkOrder = new Map<string, Group>();
    for (const r of records) {
      if (filter === 'pending' && r.idleTimeIssue) continue;
      if (filter === 'done' && !r.idleTimeIssue) continue;
      if (
        keyword &&
        !r.workOrder.toLowerCase().includes(keyword) &&
        !r.modelSuffix.toLowerCase().includes(keyword)
      ) {
        continue;
      }
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
    const list = [...byWorkOrder.values()];
    /**
     * ในกลุ่มเรียงตามเวลาที่เกิดจริง (เช้าก่อน) แล้วนับ 1..n ใหม่บนแถวย่อย
     * เลข no เป็นลำดับของทั้งกะ ถ้าใช้ตรง ๆ กลุ่มจะเริ่มที่ #2 หรือเลขกระโดด ทำให้พนักงานงง
     */
    for (const g of list) {
      g.records.sort((a, b) => shiftTimeOrder(a.startTime) - shiftTimeOrder(b.startTime));
    }
    /*
      เรียงกลุ่มตามที่เลือก (ปุ่มข้างช่องค้นหา ผู้ใช้ขอ 2026-11-10)
      เทียบเวลาด้วยลำดับในกะ กะที่ข้ามเที่ยงคืนจึงเรียงถูก
    */
    const latest = (a: Group, b: Group) => shiftTimeOrder(b.endTime) - shiftTimeOrder(a.endTime);
    if (sort === 'latest') list.sort(latest);
    else if (sort === 'oldest')
      list.sort((a, b) => shiftTimeOrder(a.startTime) - shiftTimeOrder(b.startTime));
    else if (sort === 'longest') list.sort((a, b) => b.totalMins - a.totalMins);
    else
      list.sort((a, b) => Number(b.pendingCount > 0) - Number(a.pendingCount > 0) || latest(a, b));
    return list;
  }, [records, search, filter, sort]);

  const minUnit = t('timelineMinutes');

  /** ส่วนที่เลื่อนหายไปพร้อมรายการ แถบบนจึงเหลือแถวเดียว จอหนึ่งเห็นรายการได้มากขึ้น */
  const header = (
    <View style={styles.listHeader}>
      {timeline?.key === timelineKey && (
        <LineStatusTimeline
          timeline={timeline.data}
          line={selectedLine}
          isToday={isToday}
          onPress={() => setTimelineFullscreen(true)}
        />
      )}

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

      {/* ตัวกรองบอกจำนวนในตัว ลีดเดอร์กดดูเฉพาะงานที่ค้างได้ทันที ซ่อนระหว่างโหลดไม่ให้เห็นเลข 0 หลอก ๆ */}
      {!loading && (
        <View style={styles.filterRow} accessibilityRole="radiogroup">
          <FilterChip
            label={t('filterAll')}
            count={records.length}
            active={filter === 'all'}
            icon={(color) => <ChartColumnIcon color={color} size={18} />}
            tone="neutral"
            onPress={() => setFilter('all')}
            styles={styles}
          />
          <FilterChip
            label={t('filterDone')}
            count={records.length - pendingTotal}
            active={filter === 'done'}
            icon={(color) => <CircleCheckIcon color={color} size={18} />}
            iconColor={c.success}
            tone="success"
            onPress={() => setFilter('done')}
            styles={styles}
          />
          <FilterChip
            label={t('filterPending')}
            count={pendingTotal}
            active={filter === 'pending'}
            icon={(color) => <CircleXIcon color={color} size={18} />}
            iconColor={c.danger}
            tone={pendingTotal > 0 ? 'danger' : 'success'}
            onPress={() => setFilter('pending')}
            styles={styles}
          />
        </View>
      )}

      <View style={[styles.searchWrap, styles.searchRow]}>
        <View style={styles.searchFlex}>
          <SearchField
            value={search}
            onChangeText={setSearch}
            placeholder={t('searchPlaceholder')}
            clearLabel={t('clearSearch')}
          />
        </View>
        {/* ปุ่มเรียงลำดับ พื้นน้ำเงินเมื่อไม่ได้ใช้ลำดับเริ่มต้น จะได้รู้ว่ารายการถูกเรียงแบบอื่นอยู่ */}
        <TouchableOpacity
          style={[styles.sortButton, sort !== 'latest' && styles.sortButtonActive]}
          onPress={() => setSortOpen(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${t('sortTitle')}: ${t(SORT_LABEL[sort])}`}>
          <SortIcon color={sort !== 'latest' ? c.onPrimary : c.iconBlue} size={22} />
        </TouchableOpacity>
        <OptionSheet
          visible={sortOpen}
          onClose={() => setSortOpen(false)}
          title={t('sortTitle')}
          options={SORT_KEYS.map((k) => ({ value: k, label: t(SORT_LABEL[k]) }))}
          selected={sort}
          onSelect={setSort}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* แถบบนแถวเดียว: วันที่กับไลน์อยู่ด้วยกัน */}
      <View style={styles.topBar}>
        <View style={styles.dateGroup}>
          <TouchableOpacity
            style={styles.dateNav}
            onPress={() => setShiftDate((d) => addDays(d, -1))}
            accessibilityRole="button"
            accessibilityLabel={t('previousDay')}>
            <ChevronLeftIcon color={c.iconBlue} size={24} strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateCenter}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={shiftDate}>
            {/* ไอคอนปฏิทินบอกว่าแตะที่วันที่แล้วเลือกวันได้ */}
            <View style={styles.dateRow}>
              <CalendarDaysIcon color={c.iconGray} size={16} />
              <Text style={styles.dateText} numberOfLines={1}>
                {shortDate(shiftDate, language)}
              </Text>
            </View>
            <View style={styles.dateRow}>
              {isToday && <CalendarCheckIcon color={c.iconGreen} size={14} />}
              <Text style={[styles.dateHint, !isToday && styles.dateHintPast]} numberOfLines={1}>
                {isToday ? t('shiftToday') : t('shiftPast')}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dateNav, isToday && styles.dateNavDisabled]}
            onPress={() => setShiftDate((d) => addDays(d, 1))}
            disabled={isToday}
            accessibilityRole="button"
            accessibilityLabel={t('nextDay')}>
            <ChevronRightIcon color={c.iconBlue} size={24} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        <View style={styles.lineGroup}>
          <LinePicker
            lines={LINES}
            selected={selectedLine}
            onSelect={setSelectedLine}
            title={t('timelineSelectLine')}
          />
        </View>
      </View>

      {!isToday && (
        <TouchableOpacity style={styles.todayButton} onPress={() => setShiftDate(today)}>
          <CalendarCheckIcon color={c.iconBlue} size={16} />
          <Text style={styles.todayButtonText}>{t('backToToday')}</Text>
        </TouchableOpacity>
      )}

      {/* อยู่นอกรายการ ไม่เลื่อนหายไปตอนผู้ใช้เลื่อนดูรายการด้านล่าง */}
      <NewDataBanner
        count={newCount}
        onPress={() => {
          dismiss();
          void onRefresh();
        }}
      />

      {/* เลือกวันย้อนหลังได้ไกลตามต้องการ แต่เลือกอนาคตไม่ได้ เพราะกะที่ยังไม่เกิดย่อมไม่มีรายการ */}
      <MonthCalendar
        visible={showDatePicker}
        value={shiftDate}
        maxDate={today}
        onSelect={setShiftDate}
        onClose={() => setShowDatePicker(false)}
      />

      {/*
        อยู่นอกเงื่อนไขของการ์ด เพราะสลับไลน์จากในหน้าเต็มจอได้
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

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={c.primary} />
      ) : (
        <FlatList
          ref={listRef}
          data={groups}
          keyExtractor={(g) => g.workOrder}
          ListHeaderComponent={header}
          renderItem={({ item: g, index }) => {
            /*
              work order ที่มีรายการเดียวไม่ต้องทำเป็นกลุ่ม
              เพราะหัวกลุ่มจะบอกข้อมูลซ้ำกับแถวข้างในทั้งหมด และยังต้องกดเปิดอีกหนึ่งครั้ง
            */
            if (g.records.length < 2) {
              return (
                <RecordRow
                  record={g.records[0]}
                  onPress={openDetail}
                  minUnit={minUnit}
                  styles={styles}
                  editingBy={editing.get(g.records[0].id)}
                />
              );
            }
            const isOpen = expanded === g.workOrder;
            return (
              <View style={styles.groupWrap}>
                <GroupRow
                  group={g}
                  expanded={isOpen}
                  onToggle={() => toggleGroup(g.workOrder, index)}
                  minUnit={minUnit}
                  styles={styles}
                  editingBy={g.records.map((r) => editing.get(r.id)).find(Boolean)}
                />
                {isOpen &&
                  g.records.map((r, i) => (
                    <RecordRow
                      key={r.id}
                      record={r}
                      onPress={openDetail}
                      minUnit={minUnit}
                      styles={styles}
                      position={i + 1}
                      editingBy={editing.get(r.id)}
                    />
                  ))}
              </View>
            );
          }}
          ItemSeparatorComponent={Separator}
          /* เผื่อความสูงแถบนำทางด้านล่าง ให้แถวสุดท้ายเลื่อนขึ้นมาพ้นปุ่มนำทางได้ */
          contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}
          /*
            จำนวนแถวที่วาดล่วงหน้า ตั้งให้พอดีกับที่เห็นบนจอจริง
            ไม่ใช้ removeClippedSubviews เพราะบน Android ทำให้แถวกลายเป็นช่องว่างเป็นครั้งคราว
            ซึ่งหน้างานอ่านผิดได้ว่าไม่มีรายการ อันตรายกว่าที่จะได้ความเร็วเพิ่มเล็กน้อย
          */
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {/* กรองแล้วว่าง ไม่ได้แปลว่าวันนี้ไม่มีรายการ ต้องบอกให้ตรง ไม่งั้นลีดเดอร์เข้าใจผิด */}
              {records.length === 0 || search || filter === 'all'
                ? t('emptyList')
                : filter === 'pending'
                  ? `✓ ${t('filterAllDoneHint')}`
                  : t('filterNoneDone')}
            </Text>
          }
          /*
            แถวแต่ละแถวสูงไม่เท่ากัน FlatList จึงกระโดดไปตำแหน่งที่ยังไม่ได้วัดไม่ได้
            กรณีนั้นให้เลื่อนแบบประมาณก่อนแล้วค่อยกระโดดซ้ำอีกครั้งเมื่อวัดเสร็จ
          */
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true });
            setTimeout(() => {
              listRef.current?.scrollToIndex({ index, viewPosition: 0, animated: true });
            }, 120);
          }}
        />
      )}
    </View>
  );
}

/** ความถี่ถามว่าใครกำลังกรอกอยู่ ต้องสั้นกว่าเวลาที่ server ปล่อยล็อก (90 วินาที) มาก */
const PRESENCE_POLL_MS = 15_000;

type SortKey = 'latest' | 'oldest' | 'longest' | 'pending';
const SORT_KEYS: SortKey[] = ['latest', 'oldest', 'longest', 'pending'];
const SORT_LABEL: Record<SortKey, TranslationKey> = {
  latest: 'sortLatest',
  oldest: 'sortOldest',
  longest: 'sortLongest',
  pending: 'sortPendingFirst',
};

type Styles = ReturnType<typeof createStyles>;

function Separator() {
  const c = useColors();
  return <View style={{ height: 1, backgroundColor: c.border }} />;
}

function FilterChip({
  label,
  count,
  active,
  tone,
  icon,
  iconColor,
  onPress,
  styles,
}: {
  label: string;
  count: number;
  active: boolean;
  tone: 'danger' | 'success' | 'neutral';
  /** ไอคอนนำหน้า รับสีเข้ามา เพราะตอนเลือกอยู่ต้องเป็นสีขาวบนพื้นน้ำเงิน */
  icon: (color: string) => ReactNode;
  /** สีไอคอนตอนไม่ได้เลือก ไม่ส่ง = สีเดียวกับตัวอักษร */
  iconColor?: string;
  onPress: () => void;
  styles: Styles;
}) {
  const c = useColors();
  const toneStyle =
    tone === 'danger'
      ? styles.countDanger
      : tone === 'success'
        ? styles.countSuccess
        : styles.countNeutral;
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}>
      {icon(active ? c.onPrimary : (iconColor ?? c.textSecondary))}
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
      {/* ตอนเลือกอยู่ เลขเป็นเม็ดขาวตัวน้ำเงิน อ่านออกบนพื้นน้ำเงิน */}
      <View style={[styles.countPill, active ? styles.countPillActive : toneStyle]}>
        <Text style={[styles.countText, active && styles.countTextActive]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * แถวรายการแบบกะทัดรัด
 * คอลัมน์ซ้ายเป็นเวลา ให้กวาดสายตาตามลำดับเวลาได้ คอลัมน์ขวาเป็นนาทีตัวใหญ่ ให้เห็นรายการที่หยุดนานก่อน
 * สีแดงเหลือแค่แถบซ้ายกับตัวเลข ไม่ทาทั้งแถว ตอนค้างหลายรายการจอจะไม่แดงไปหมดจนแยกไม่ออก
 *
 * กะหนึ่งมีได้หลักร้อยรายการ ถ้าไม่ memo ไว้ การพิมพ์ค้นหาหนึ่งตัวอักษร
 * จะสั่งให้ทุกแถวเรนเดอร์ใหม่ทั้งหมด ซึ่งหน่วงชัดบนมือถือรุ่นกลางที่ใช้หน้างาน
 */
const RecordRow = memo(function RecordRow({
  record,
  onPress,
  minUnit,
  styles,
  position,
  editingBy,
}: {
  record: IdleTimeRecord;
  onPress: (r: IdleTimeRecord) => void;
  minUnit: string;
  styles: Styles;
  /** ลำดับในกลุ่มที่กางอยู่ (เริ่ม 1) ส่งมาเมื่อเป็นแถวย่อยเท่านั้น หัวกลุ่มบอก work order/model ไปแล้ว */
  position?: number;
  /** ชื่อคนที่กำลังกรอกรายการนี้อยู่บนเครื่องอื่น */
  editingBy?: string;
}) {
  const { t } = useLanguage();
  const status = statusOf(record);
  const nested = position !== undefined;
  return (
    <TouchableOpacity
      style={[styles.row, nested && styles.rowNested]}
      onPress={() => onPress(record)}
      activeOpacity={0.7}>
      <View style={[styles.statusBar, styles[`bar_${status}`]]} />
      <TimeBlock start={record.startTime} end={record.endTime} styles={styles} />
      <View style={styles.mainCol}>
        <Text style={styles.title} numberOfLines={1}>
          {nested ? `#${position}` : record.workOrder}
        </Text>
        {!nested && (
          <Text style={styles.sub} numberOfLines={1}>
            {record.modelSuffix}
          </Text>
        )}
        {status === 'pending' ? (
          <Text style={styles.pendingLabel} numberOfLines={1}>
            ● {t('badgePending')}
            <Text style={styles.sub}>
              {'  ·  '}
              {t('lotSizeLabel')} {record.lotSize}
            </Text>
          </Text>
        ) : (
          <Text style={[styles.issue, status === 'break' && styles.issueBreak]} numberOfLines={1}>
            {status === 'break' ? `◐ ${t('badgeBreak')}` : `✓ ${record.idleTimeIssue}`}
          </Text>
        )}
        {editingBy && <EditingLabel name={editingBy} styles={styles} />}
      </View>
      <View style={styles.minsCol}>
        <Text style={[styles.mins, styles[`mins_${status}`]]}>{record.totalMins.toFixed(2)}</Text>
        <Text style={styles.minsUnit}>{minUnit}</Text>
      </View>
    </TouchableOpacity>
  );
});

/**
 * ไอคอนนาฬิกา + ลูกศร วาดตามแบบ clock-arrow-up / clock-arrow-down ของ Lucide (ISC license)
 * ลูกศรขึ้นสีเขียว = เวลาเริ่ม Idle, ลูกศรลงสีแดง = เวลาสิ้นสุด Idle
 */
function ClockArrowIcon({ direction, color }: { direction: 'up' | 'down'; color: string }) {
  const up = direction === 'up';
  return (
    <Svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round">
      <Path
        d={
          up
            ? 'M13.228 21.925A10 10 0 1 1 21.994 12.338'
            : 'M12.338 21.994A10 10 0 1 1 21.925 13.227'
        }
      />
      <Path d={up ? 'M12 6v6l1.562.781' : 'M12 6v6l2 1'} />
      <Path d={up ? 'm14 18 4-4 4 4' : 'm14 18 4 4 4-4'} />
      <Path d={up ? 'M18 22v-8' : 'M18 14v8'} />
    </Svg>
  );
}

/**
 * เวลาเริ่มและจบซ้อนกันสองบรรทัด ตัวเลขขนาดเท่ากัน มีไอคอนบอกว่าบรรทัดไหนเริ่ม บรรทัดไหนจบ
 * เดิมเวลาจบเป็นตัวเล็กสีเทา อ่านยากใต้แสงจ้า และดูไม่ออกว่าเป็นช่วงเวลาเดียวกัน
 */
function TimeBlock({ start, end, styles }: { start: string; end: string; styles: Styles }) {
  const c = useColors();
  return (
    <View style={styles.timeBox} accessibilityLabel={`${start} – ${end}`}>
      <View style={styles.timeLine}>
        <ClockArrowIcon direction="up" color={c.success} />
        <Text style={styles.timeStart}>{start}</Text>
      </View>
      <View style={styles.timeLine}>
        <ClockArrowIcon direction="down" color={c.danger} />
        <Text style={styles.timeEnd}>{end}</Text>
      </View>
    </View>
  );
}

/** ป้าย "กำลังกรอก" บอกว่าอีกเครื่องเปิดรายการนี้อยู่ เปิดเข้าไปจะดูได้อย่างเดียว */
function EditingLabel({ name, styles }: { name: string; styles: Styles }) {
  const { t } = useLanguage();
  return (
    <Text style={styles.editingLabel} numberOfLines={1}>
      🔒 {t('editingNow').replace('{name}', name)}
    </Text>
  );
}

/** ไอคอน list-checks ของ Lucide (ISC license) */
function ListChecksIcon({ color }: { color: string }) {
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
      <Path d="m3 17 2 2 4-4" />
      <Path d="m3 7 2 2 4-4" />
      <Path d="M13 6h8" />
      <Path d="M13 12h8" />
      <Path d="M13 18h8" />
    </Svg>
  );
}

/** หัวกลุ่มของ work order ที่มีหลายรายการ แตะเพื่อกางรายการย่อย */
function GroupRow({
  group: g,
  expanded,
  onToggle,
  minUnit,
  styles,
  editingBy,
}: {
  group: Group;
  expanded: boolean;
  onToggle: () => void;
  minUnit: string;
  styles: Styles;
  /** มีคนกำลังกรอกรายการใดรายการหนึ่งในกลุ่มนี้ */
  editingBy?: string;
}) {
  const { t } = useLanguage();
  const c = useColors();
  const status = g.pendingCount > 0 ? 'pending' : 'done';
  const done = g.records.length - g.pendingCount;
  return (
    <TouchableOpacity
      style={[styles.row, expanded && styles.rowExpanded]}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ expanded }}>
      <View style={[styles.statusBar, styles[`bar_${status}`]]} />
      <TimeBlock start={g.startTime} end={g.endTime} styles={styles} />
      <View style={styles.mainCol}>
        <Text style={styles.title} numberOfLines={1}>
          {g.workOrder}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {g.modelSuffix}
        </Text>
        <Text
          style={[status === 'pending' ? styles.pendingLabel : styles.issue, styles.groupStatus]}
          numberOfLines={1}>
          {status === 'pending' ? `● ${g.pendingCount} ${t('pendingCount')}` : `✓ ${t('allDone')}`}
        </Text>
        {editingBy && <EditingLabel name={editingBy} styles={styles} />}
      </View>
      {/* ปุ่มกางอยู่มุมขวาล่าง ใต้ยอดนาที ตำแหน่งเดียวกันทุกกลุ่ม หาเจอง่ายตอนเลื่อนผ่าน */}
      <View style={[styles.minsCol, styles.minsColGroup]}>
        <View style={styles.minsTop}>
          <Text style={[styles.mins, styles[`mins_${status}`]]}>{g.totalMins.toFixed(2)}</Text>
          <Text style={styles.minsUnit}>{minUnit}</Text>
        </View>
        {/*
          ความคืบหน้าของกลุ่ม: ไอคอน + "ทำแล้ว/ทั้งหมด" ชิดมุมขวาล่าง (ผู้ใช้กำหนด 2026-11-10 ไม่มีบรรทัดคำอธิบาย ชื่อ Model จะได้ไม่ถูกตัด)
          แตะตรงไหนของแถวก็กางได้ ส่วนนี้เป็นตัวบอกเท่านั้น สถานะกางดูจากพื้นแถว (rowExpanded)
        */}
        <View style={styles.progress}>
          {/* ครบทุกรายการ = เขียว, ยังไม่ครบ (รวมทำไปบางส่วน) = น้ำเงิน (ผู้ใช้กำหนด 2026-11-10) */}
          <ListChecksIcon color={done === g.records.length ? c.success : c.primary} />
          <Text style={styles.progressTitle} numberOfLines={1}>
            {done}/{g.records.length} {t('itemsCount')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** การ์ดขอบมนเงาบาง โหมดมืดเงามองไม่เห็นจึงใช้เส้นขอบแทน */
const softShadow = (c: ThemeColors, isDark: boolean) =>
  isDark
    ? { borderWidth: 1, borderColor: c.border }
    : { boxShadow: '0px 2px 10px rgba(15, 23, 42, 0.08)' };

const createStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    /** แถบวันที่/ไลน์อยู่บนพื้นของหน้า กลุ่มวันที่เป็นการ์ดลอย (ผู้ใช้ขอ 2026-11-10) */
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    dateGroup: {
      flex: 11,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: controlHeight,
      borderRadius: radius.md,
      backgroundColor: c.surface,
      ...softShadow(c, isDark),
    },
    lineGroup: { flex: 8 },
    dateNav: {
      width: 40,
      height: controlHeight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateNavDisabled: { opacity: 0.25 },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dateCenter: { flex: 1, alignItems: 'center' },
    dateText: { fontSize: font.body, fontWeight: '800', color: c.textPrimary },
    dateHint: { fontSize: font.small, color: c.success, fontWeight: '700' },
    dateHintPast: { color: c.warning },
    /** ทำเป็นชิปแทนข้อความเปล่า ให้เห็นชัดว่ากดได้ */
    todayButton: {
      alignSelf: 'center',
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: c.chipBg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    todayButtonText: { color: c.primary, fontSize: font.small, fontWeight: '700' },
    listHeader: { paddingTop: spacing.md },
    filterRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.xs,
    },
    chip: {
      flex: 1,
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs + 2,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: c.surface,
      ...softShadow(c, isDark),
    },
    /** แท็บที่เลือก: พื้นน้ำเงินทึบ ตัวอักษรขาว เห็นชัดว่ากำลังกรองแบบไหน */
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipText: { fontSize: font.body - 1, fontWeight: '700', color: c.textSecondary, flexShrink: 1 },
    chipTextActive: { color: c.onPrimary },
    countPill: {
      minWidth: 26,
      paddingHorizontal: spacing.xs + 2,
      paddingVertical: 2,
      borderRadius: radius.pill,
      alignItems: 'center',
    },
    countDanger: { backgroundColor: c.statusPendingFill },
    countSuccess: { backgroundColor: c.statusDoneFill },
    countNeutral: { backgroundColor: c.textSecondary },
    countText: { fontSize: font.small, fontWeight: '800', color: c.onStatus },
    countPillActive: { backgroundColor: c.surface },
    countTextActive: { color: c.primary },
    searchWrap: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    searchFlex: { flex: 1 },
    sortButton: {
      width: controlHeight,
      height: controlHeight,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    sortButtonActive: { backgroundColor: c.primary, borderColor: c.primary },
    /** รายการเป็นแถวต่อกันในแผ่นเดียว ไม่ใช่การ์ดลอยทีละใบ จอเดียวเห็นได้มากขึ้น */
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 72,
      paddingVertical: spacing.sm,
      paddingRight: spacing.lg,
      backgroundColor: c.surface,
    },
    /**
     * แถวย่อยในกลุ่มที่กางอยู่: พื้นขาวเหมือนแถวปกติ
     * เยื้องเข้าไปและมีเส้นคั่นบน ให้รู้ว่าเป็นรายการย่อยของหัวกลุ่มด้านบน
     */
    rowNested: {
      paddingLeft: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.groupChildBg,
    },
    groupWrap: { backgroundColor: c.surface },
    /** แถวหัวกลุ่มที่กางอยู่ พื้นสีอ่อนให้เห็นว่าแถวย่อยด้านล่างเป็นของกลุ่มนี้ */
    rowExpanded: {
      backgroundColor: c.groupHeaderBg,
      borderBottomWidth: 2,
      borderBottomColor: c.primary,
    },
    groupStatus: { flexShrink: 1 },
    /** คอลัมน์ขวาของหัวกลุ่ม: ยอดนาทีอยู่บน ปุ่มกางอยู่ล่าง ชิดขวาทั้งคู่ */
    minsColGroup: { alignSelf: 'stretch', justifyContent: 'space-between', gap: spacing.xs },
    minsTop: { alignItems: 'flex-end' },
    progress: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    progressTitle: { fontSize: font.small, fontWeight: '800', color: c.textPrimary },
    /** แถบสีหนาทางซ้ายบอกสถานะ ใช้หลักเดียวกับจอควบคุมในโรงงาน (ISA-101) */
    statusBar: { alignSelf: 'stretch', width: 6, marginRight: spacing.md },
    bar_pending: { backgroundColor: c.statusPendingFill },
    bar_done: { backgroundColor: c.statusDoneFill },
    /** ช่วงพัก = เหลือง บอกว่าหยุดจริงแต่เป็นตามแผน ไม่ใช่ปัญหาที่ต้องตามแก้ */
    bar_break: { backgroundColor: c.statusBreakFill },
    timeBox: {
      width: 82,
      alignItems: 'center',
      paddingVertical: spacing.xs,
      marginRight: spacing.md,
    },
    timeLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 1 },
    timeStart: {
      fontSize: font.body,
      fontWeight: '800',
      color: c.textPrimary,
      // ตัวเลขความกว้างเท่ากันทุกหลัก ทำให้เวลาในแต่ละแถวเรียงตรงกันเวลากวาดสายตา
      fontVariant: ['tabular-nums'],
    },
    timeEnd: {
      fontSize: font.body,
      fontWeight: '600',
      color: c.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    mainCol: { flex: 1, gap: 2 },
    title: { fontSize: font.body, fontWeight: '800', color: c.textPrimary },
    sub: { fontSize: font.small, fontWeight: '400', color: c.textSecondaryStrong },
    pendingLabel: { fontSize: font.small, fontWeight: '700', color: c.danger },
    issue: { fontSize: font.small, fontWeight: '600', color: c.success },
    /** ช่วงพัก: ตัวอักษรเหลืองสด ไม่มีพื้น (ผู้ใช้กำหนด 2026-11-10) */
    issueBreak: { color: c.breakAccent },
    editingLabel: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      overflow: 'hidden',
      fontSize: font.small,
      fontWeight: '700',
      color: c.textPrimary,
      backgroundColor: c.breakBg,
    },
    minsCol: { alignItems: 'flex-end', marginLeft: spacing.sm, minWidth: 56 },
    mins: { fontSize: font.h2 + 1, fontWeight: '800', fontVariant: ['tabular-nums'] },
    mins_pending: { color: c.danger },
    /** กรอกสาเหตุแล้วไม่ต้องเร่งด้วยสีแดงอีก แต่ยังตัวหนาให้อ่านยอดนาทีได้ทันที */
    mins_done: { color: c.textPrimary },
    /** เวลาที่หยุดในช่วงพักไม่ควรเป็นสีแดง เพราะไม่ได้เป็นเวลาที่เสียไปจริง */
    mins_break: { color: c.breakAccent },
    minsUnit: { fontSize: font.small, color: c.textSecondary },
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

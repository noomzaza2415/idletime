import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useColors } from '@/context/theme-context';

/**
 * ป้ายสถานะไลน์จากเครื่องจักร (ช่อง Status) ตรงกับตารางบนเว็บ
 * เว็บเทียบแบบ "มีคำนี้อยู่ในข้อความ" ไม่สนตัวพิมพ์: rework = ส้ม, running = เขียว
 * สถานะอื่นแสดงเป็นตัวหนังสือธรรมดา ไม่เดาสีให้เอง
 */
export default function MachineStatusBadge({ status }: { status: string }) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const s = status.toLowerCase();
  const tone = s.includes('rework') ? 'rework' : s.includes('running') ? 'running' : null;

  if (!tone) return <Text style={styles.plain}>{status}</Text>;
  return (
    <View style={[styles.badge, tone === 'rework' ? styles.rework : styles.running]}>
      <Text style={[styles.text, { color: tone === 'rework' ? c.machineReworkText : c.machineRunningText }]}>
        {status}
      </Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    badge: {
      alignSelf: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm / 2,
      borderWidth: 1,
      marginTop: 2,
    },
    running: { backgroundColor: c.machineRunningBg, borderColor: c.machineRunningBorder },
    rework: { backgroundColor: c.machineReworkBg, borderColor: c.machineReworkBorder },
    text: { fontSize: font.small, fontWeight: '800', letterSpacing: 0.5 },
    plain: { fontSize: font.body, fontWeight: '700', color: c.textPrimary, marginTop: 2 },
  });

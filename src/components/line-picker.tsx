import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronDownIcon, FactoryIcon } from '@/components/icons';
import { controlHeight, font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useColors } from '@/context/theme-context';

interface Props {
  lines: string[];
  selected: string;
  onSelect: (line: string) => void;
  /** หัวข้อของแผ่นเลือก และใช้เป็นชื่อปุ่มสำหรับ screen reader */
  title: string;
  /** สูง 44 สำหรับแถบหัวของหน้าเต็มจอที่พื้นที่แนวตั้งน้อย ปกติสูงเท่า controlHeight */
  compact?: boolean;
  /** พื้นทึบสีหลัก ตัวอักษรขาว ใช้ในหน้ากราฟเต็มจอให้ปุ่มเลือกไลน์เด่นที่สุดในแถบเครื่องมือ */
  prominent?: boolean;
}

/** หน้าเต็มจอใช้ปุ่มสูง 44 อยู่แล้ว (TOUCH ใน line-status-fullscreen.tsx) ยังเกินเกณฑ์ขั้นต่ำของเป้ากด */
const COMPACT_HEIGHT = 44;

/**
 * ปุ่มเลือกไลน์แบบ dropdown แทนแท็บ เพราะแท็บวางได้แค่ 2-3 ไลน์ในความกว้างที่มี
 * เพิ่มไลน์ในอนาคตแค่เพิ่มชื่อในรายการ แผ่นเลือกเลื่อนได้ ไม่ต้องแก้หน้าตา
 *
 * ใช้ Modal ของ React Native เอง ไม่ต้องเพิ่ม library
 * แต่ละแถวในแผ่นสูง controlHeight ให้กดได้ตอนใส่ถุงมือ
 * เปิดซ้อนบนหน้าเต็มจอแนวนอนได้ จึงต้องประกาศรองรับทั้งสองแนว ไม่งั้น iOS จะหมุนจอกลับเป็นแนวตั้ง
 */
export default function LinePicker({
  lines,
  selected,
  onSelect,
  title,
  compact,
  prominent,
}: Props) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          compact && styles.buttonCompact,
          prominent && styles.buttonProminent,
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${selected}`}>
        <View style={styles.buttonLabel}>
          <FactoryIcon color={prominent ? c.onPrimary : c.iconBlue} size={20} />
          <Text
            style={[styles.buttonText, prominent && styles.buttonTextProminent]}
            numberOfLines={1}>
            {selected.toUpperCase()}
          </Text>
        </View>
        <ChevronDownIcon color={prominent ? c.onPrimary : c.iconGray} size={20} strokeWidth={2.5} />
      </TouchableOpacity>

      <OptionSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={title}
        options={lines.map((l) => ({ value: l, label: l.toUpperCase() }))}
        selected={selected}
        onSelect={onSelect}
      />
    </>
  );
}

export interface SheetOption<T extends string> {
  value: T;
  label: string;
}

/**
 * แผ่นตัวเลือกที่เลื่อนขึ้นจากด้านล่าง ใช้ร่วมกันระหว่างปุ่มเลือกไลน์และปุ่มเลือกภาษา
 * แตะตัวเลือกแล้วปิดเอง แตะพื้นมืดหรือกด back เพื่อปิดโดยไม่เปลี่ยนค่า
 */
export function OptionSheet<T extends string>({
  visible,
  onClose,
  title,
  options,
  selected,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: SheetOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const c = useColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* กันไม่ให้การแตะในแผ่นทะลุไปปิด modal */}
        <Pressable
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + spacing.lg,
              paddingLeft: insets.left + spacing.lg,
              paddingRight: insets.right + spacing.lg,
            },
          ]}>
          <Text style={styles.title}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            style={styles.list}
            renderItem={({ item }) => {
              const active = item.value === selected;
              return (
                <TouchableOpacity
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => {
                    if (!active) onSelect(item.value);
                    onClose();
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}>
                  <Text style={[styles.rowText, active && styles.rowTextActive]}>{item.label}</Text>
                  {active && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    button: {
      height: controlHeight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      borderWidth: 2,
      borderColor: c.primary,
      backgroundColor: c.chipBg,
    },
    buttonCompact: { height: COMPACT_HEIGHT, minWidth: 120 },
    buttonProminent: { backgroundColor: c.primary, borderColor: c.primary },
    buttonTextProminent: { color: c.onPrimary },
    buttonText: {
      flexShrink: 1,
      fontSize: font.body,
      fontWeight: '800',
      letterSpacing: 1,
      color: c.textPrimary,
    },
    buttonLabel: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      maxHeight: '70%',
      paddingTop: spacing.lg,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      backgroundColor: c.surface,
    },
    title: {
      fontSize: font.h2,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: spacing.md,
    },
    list: { flexGrow: 0 },
    row: {
      minHeight: controlHeight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border,
    },
    rowActive: {
      borderColor: c.primary,
      borderWidth: 2,
      backgroundColor: c.chipBg,
    },
    // ไม่เว้นระยะตัวอักษร ภาษาไทยในรายการสาเหตุจะดูขาดเป็นตัว ๆ
    rowText: {
      flexShrink: 1,
      fontSize: font.body,
      fontWeight: '700',
      color: c.textSecondary,
    },
    rowTextActive: { color: c.textPrimary, fontWeight: '800' },
    check: { fontSize: font.h2, fontWeight: '800', color: c.primary },
  });

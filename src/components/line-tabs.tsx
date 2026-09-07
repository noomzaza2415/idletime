import { useMemo } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { font, spacing } from '@/constants/theme';

const IDLE_TEXTURE = require('../../assets/images/tab-idle.png');
const ACTIVE_TEXTURE = require('../../assets/images/tab-active.png');

/**
 * ปุ่มเลือกไลน์ทรง segmented control แบบปุ่มจริง
 * ตัวที่ไม่ได้เลือกเป็นเทาเข้มนูนขึ้น (ไล่สี + เส้นสว่างขอบบน + เงาใต้ปุ่ม)
 * ตัวที่เลือกเป็นน้ำเงินสดของแอป ดูเหมือนปุ่มติดไฟ
 *
 * ชุดสีตรึงไว้ ไม่ได้ดึงจาก palette จึงหน้าตาเหมือนกันทั้งโหมดมืดและสว่าง
 * ทุกคู่สีผ่านเกณฑ์ contrast 4.5:1 ตลอดความสูงของปุ่ม
 */
const TAB = {
  tray: '#14181F',
  idleTopEdge: '#4E5666',
  idleFallback: '#2F343E',
  activeFallback: '#1D4ED8',
  idleText: '#D1D5DB',
  activeText: '#FFFFFF',
} as const;

interface Props {
  lines: string[]; // เช่น ['Line1', 'Line2']
  selected: string;
  onSelect: (line: string) => void;
}

export default function LineTabs({ lines, selected, onSelect }: Props) {
  const styles = useMemo(() => createStyles(), []);

  return (
    <View style={styles.wrap}>
      <View style={styles.tray}>
        {lines.map((line, index) => {
          const active = line === selected;

          return (
            <TouchableOpacity
              key={line}
              onPress={() => onSelect(line)}
              activeOpacity={0.9}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[
                styles.label,
                index === 0 && styles.labelFirst,
                index === lines.length - 1 && styles.labelLast,
                active ? styles.labelActive : styles.labelIdle,
              ]}>
              {/* ไล่สีอบไว้เป็น PNG เพราะ RN ไม่มี linear-gradient */}
              <Image
                source={active ? ACTIVE_TEXTURE : IDLE_TEXTURE}
                style={styles.texture}
                resizeMode="stretch"
              />
              <Text style={[styles.text, active && styles.textActive]}>{line}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    wrap: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    tray: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: TAB.tray,
      padding: 4,
      borderRadius: 10,
    },
    label: {
      // ต้นฉบับกว้างคงที่ 90px แต่ของเราแบ่งครึ่งจอตามที่ตั้งไว้ก่อนหน้า
      flex: 1,
      height: 60,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.sm,
    },
    labelIdle: {
      backgroundColor: TAB.idleFallback,
      borderTopWidth: 1,
      borderTopColor: TAB.idleTopEdge,
      boxShadow: '0px 17px 5px 1px rgba(0, 0, 0, 0.2)',
    },
    /** ปุ่มที่เลือกดูยุบลง: ไม่มีเส้นขอบบน ไม่มีเงา */
    labelActive: { backgroundColor: TAB.activeFallback },
    labelFirst: { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
    labelLast: { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
    /**
     * ตัดมุมที่ตัวภาพเอง แทนการใส่ overflow: hidden ที่ปุ่ม
     * เพราะบน Android ทำให้ลูกของปุ่มขวาสุดหายไปทั้งหมด
     */
    texture: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: undefined,
      height: undefined,
      borderRadius: 6,
    },
    text: {
      fontSize: font.small,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: TAB.idleText,
      textShadowColor: 'rgba(0, 0, 0, 0.45)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    textActive: {
      color: TAB.activeText,
      textShadowColor: 'rgba(0, 0, 0, 0.35)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
  });

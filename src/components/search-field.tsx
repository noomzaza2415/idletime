import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/context/theme-context';

/** สีเส้นวิ่งรอบขอบจากดีไซน์ต้นฉบับ (Uiverse) ใช้ทั้งสองโหมด */
const INDIGO = '#402fb5';
const PINK = '#cf30aa';

/**
 * ชุดสีของช่องค้นหาแยกตามโหมด
 *
 * โหมดมืดคงสีต้นฉบับทุกค่า เพราะดีไซน์ตั้งอยู่บนพื้นดำ
 * โหมดสว่างต้องมีชุดของตัวเอง เดิมใช้ชุดดำร่วมกัน แสงฟุ้งที่ไล่จากสีดำจึงกลายเป็น
 * คราบเทาบนพื้นสว่าง และได้กล่องดำกลางหน้าจอขาวที่ดูเหมือนแสดงผลพัง
 * แสงฟุ้งโหมดสว่างจึงไล่จากสีโปร่งใสแทน ให้เหลือแค่สีม่วงชมพูจาง ๆ
 */
function createPalette(c: ThemeColors, isDark: boolean) {
  if (isDark) {
    const ink = '#010201';
    return {
      field: ink,
      text: '#ffffff',
      placeholder: '#c0b9c0',
      glow: [ink, INDIGO, ink, ink, PINK, ink],
      glowOpacity: 0.35,
      glowFocusBoost: 0.4,
      ringBase: '#1c191c',
      pinkMaskOpacity: 0.25,
      reset: ['#161329', '#000000', '#1d1b4b'],
      resetBorder: '#3d3a4f',
      resetLine: '#c0b9c0',
    } as const;
  }
  const clear = 'rgba(255,255,255,0)';
  return {
    field: c.surface,
    text: c.textPrimary,
    // textSecondary บนพื้นขาวได้ 4.8:1 ผ่านเกณฑ์อ่านได้ ต่างจากเทาอมชมพูของต้นฉบับที่จางเกินไป
    placeholder: c.textSecondary,
    glow: [clear, INDIGO, clear, clear, PINK, clear],
    glowOpacity: 0.18,
    glowFocusBoost: 0.3,
    ringBase: c.border,
    pinkMaskOpacity: 0.1,
    reset: ['#EEF2FF', '#FFFFFF', '#E0E7FF'],
    resetBorder: c.border,
    resetLine: c.textSecondary,
  } as const;
}

type Palette = ReturnType<typeof createPalette>;

const HEIGHT = 56;
/** วงไล่สีต้องใหญ่กว่ากรอบมาก เพื่อให้หมุนแล้วยังคลุมเต็มทุกมุม */
const RING = 560;

/** รอบการหมุนของขอบ ตรงกับ animation: rotate 4s linear infinite */
const SPIN_MS = 4000;
/** ตอนโฟกัสขอบกวาดเร็วขึ้น เลียนแบบ #poda:focus-within ที่ย่นเวลาลง */
const SPIN_FOCUSED_MS = 1600;

interface Props {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  /** ป้ายกำกับปุ่มล้างข้อความ สำหรับ screen reader */
  clearLabel: string;
}

/**
 * ช่องค้นหาขอบเรืองแสง แปลงจาก CSS ต้นฉบับที่ใช้ conic-gradient หมุนซ้อนกันหลายชั้น
 *
 * React Native ไม่มี conic-gradient และไม่มี filter: blur() กับ element ของตัวเอง
 * จึงเลียนแบบด้วยการวางแผ่นไล่สีทแยงขนาดใหญ่ไว้ในกรอบที่ตัดขอบมน แล้วหมุนแผ่นนั้น
 * ส่วนแสงฟุ้งใช้แผ่นสีโปร่งขนาดใหญ่กว่ากรอบซ้อนไว้ด้านหลังแทนการเบลอจริง
 */
export default function SearchField({ value, onChangeText, placeholder, clearLabel }: Props) {
  const { colors: c, isDark } = useTheme();
  const palette = useMemo(() => createPalette(c, isDark), [c, isDark]);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const spin = useSharedValue(0);
  const focus = useSharedValue(0);

  useEffect(() => {
    // หมุนค้างไว้ตลอด ให้ขอบมีชีวิตแม้ยังไม่ได้แตะ
    spin.value = withRepeat(withTiming(1, { duration: SPIN_MS, easing: Easing.linear }), -1, false);
  }, [spin]);

  function animateFocus(next: number) {
    focus.value = withTiming(next, { duration: 600, easing: Easing.out(Easing.ease) });
    spin.value = 0;
    spin.value = withRepeat(
      withTiming(1, { duration: next ? SPIN_FOCUSED_MS : SPIN_MS, easing: Easing.linear }),
      -1,
      false
    );
  }

  // แผ่นไล่สีหมุนหนึ่งรอบเต็ม มุมตั้งต้นต่างกันเล็กน้อยให้สองชั้นเหลื่อมกันเหมือนต้นฉบับ
  const borderRing = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360 + 70}deg` }],
  }));
  const glowRing = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360 + 60}deg` }],
  }));

  // อ่านค่าเป็นตัวเลขนอก worklet เพราะ worklet ใช้ได้เฉพาะค่าที่ส่งเข้าไปได้
  const { glowOpacity, glowFocusBoost } = palette;
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity + focus.value * glowFocusBoost,
  }));

  return (
    <View style={styles.wrap}>
      {/* ชั้นแสงฟุ้ง วางใหญ่กว่ากรอบและจางไว้ แทน filter: blur(30px) ของต้นฉบับ */}
      <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none">
        <Animated.View style={[styles.ringBox, glowRing]}>
          <LinearGradient
            colors={palette.glow}
            locations={[0, 0.08, 0.32, 0.5, 0.68, 0.95]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ringFill}
          />
        </Animated.View>
      </Animated.View>

      {/* ชั้นขอบ ให้เห็นเป็นเส้นสีวิ่งรอบกรอบ */}
      <View style={styles.borderClip} pointerEvents="none">
        <Animated.View style={[styles.ringBox, borderRing]}>
          <LinearGradient
            colors={[
              palette.ringBase,
              INDIGO,
              palette.ringBase,
              palette.ringBase,
              PINK,
              palette.ringBase,
            ]}
            locations={[0, 0.05, 0.14, 0.5, 0.6, 0.64]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ringFill}
          />
        </Animated.View>
      </View>

      {/* พื้นทึบทับตรงกลาง เหลือขอบสีไว้เป็นเส้นบาง ๆ รอบนอก */}
      <View style={styles.field}>
        <View style={styles.searchIcon}>
          <View style={styles.searchLens} />
          <View style={styles.searchHandle} />
        </View>

        {/* จุดชมพูฟุ้งมุมซ้าย ตรงกับ #pink-mask ที่จางหายเมื่อโฟกัส */}
        <View style={styles.pinkMask} pointerEvents="none" />

        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.placeholder}
          onFocus={() => animateFocus(1)}
          onBlur={() => animateFocus(0)}
          // work order เป็นรหัสตัวพิมพ์ใหญ่ผสมตัวเลข ปิด autocorrect ไม่ให้แก้คำมั่ว
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="search"
        />

        {/* ปุ่มล้างวางในกรอบเดียวกับ #filter-icon ของต้นฉบับ */}
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => onChangeText('')}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            style={styles.reset}>
            <LinearGradient
              colors={palette.reset}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.resetLine} />
            <View style={[styles.resetLine, styles.resetLineFlipped]} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const createStyles = (p: Palette) =>
  StyleSheet.create({
    wrap: {
      height: HEIGHT,
      justifyContent: 'center',
      // กันแสงฟุ้งล้นไปทับการ์ดรายการที่อยู่ถัดลงไป
      marginVertical: spacing.xs,
    },
    glow: {
      position: 'absolute',
      left: -10,
      right: -10,
      top: -12,
      bottom: -12,
      borderRadius: 24,
      overflow: 'hidden',
    },
    borderClip: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      borderRadius: 12,
      overflow: 'hidden',
    },
    ringBox: {
      position: 'absolute',
      width: RING,
      height: RING,
      left: '50%',
      top: '50%',
      marginLeft: -RING / 2,
      marginTop: -RING / 2,
    },
    ringFill: { flex: 1 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      height: HEIGHT - 3,
      marginHorizontal: 1.5,
      paddingHorizontal: spacing.md,
      backgroundColor: p.field,
      borderRadius: 10,
      overflow: 'hidden',
    },
    searchIcon: { width: 20, height: 20, marginRight: spacing.sm },
    searchLens: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: p.placeholder,
    },
    searchHandle: {
      position: 'absolute',
      right: 1,
      bottom: 2,
      width: 8,
      height: 2,
      borderRadius: 1,
      backgroundColor: p.placeholder,
      transform: [{ rotate: '45deg' }],
    },
    pinkMask: {
      position: 'absolute',
      left: 4,
      top: 6,
      width: 40,
      height: 28,
      borderRadius: 20,
      backgroundColor: PINK,
      opacity: p.pinkMaskOpacity,
    },
    input: {
      flex: 1,
      height: '100%',
      paddingHorizontal: spacing.xs,
      fontSize: font.body,
      color: p.text,
    },
    reset: {
      width: 38,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: p.resetBorder,
      overflow: 'hidden',
      marginLeft: spacing.sm,
    },
    resetLine: {
      position: 'absolute',
      width: 15,
      height: 2,
      borderRadius: 1,
      backgroundColor: p.resetLine,
      transform: [{ rotate: '45deg' }],
    },
    resetLineFlipped: { transform: [{ rotate: '-45deg' }] },
  });

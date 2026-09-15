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

import { font, radius, spacing } from '@/constants/theme';

/**
 * สีจากดีไซน์ต้นฉบับ (Uiverse) ตรึงไว้ไม่ผูกกับธีมของแอป
 * เพราะทั้งชุดตั้งอยู่บนพื้นดำ ถ้าดึงสีจากธีมสว่างมาใช้ เอฟเฟกต์เรืองแสงจะหายไปหมด
 */
const INK = '#010201';
const INDIGO = '#402fb5';
const PINK = '#cf30aa';
const PLACEHOLDER = '#c0b9c0';

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
  const styles = useMemo(() => createStyles(), []);
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

  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.35 + focus.value * 0.4 }));

  return (
    <View style={styles.wrap}>
      {/* ชั้นแสงฟุ้ง วางใหญ่กว่ากรอบและจางไว้ แทน filter: blur(30px) ของต้นฉบับ */}
      <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none">
        <Animated.View style={[styles.ringBox, glowRing]}>
          <LinearGradient
            colors={[INK, INDIGO, INK, INK, PINK, INK]}
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
            colors={['#1c191c', INDIGO, '#1c191c', '#1c191c', PINK, '#1c191c']}
            locations={[0, 0.05, 0.14, 0.5, 0.6, 0.64]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ringFill}
          />
        </Animated.View>
      </View>

      {/* พื้นดำทับตรงกลาง เหลือขอบสีไว้เป็นเส้นบาง ๆ รอบนอก */}
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
          placeholderTextColor={PLACEHOLDER}
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
              colors={['#161329', '#000000', '#1d1b4b']}
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

const createStyles = () =>
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
      backgroundColor: INK,
      borderRadius: 10,
      overflow: 'hidden',
    },
    searchIcon: { width: 20, height: 20, marginRight: spacing.sm },
    searchLens: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: PLACEHOLDER,
    },
    searchHandle: {
      position: 'absolute',
      right: 1,
      bottom: 2,
      width: 8,
      height: 2,
      borderRadius: 1,
      backgroundColor: PLACEHOLDER,
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
      opacity: 0.25,
    },
    input: {
      flex: 1,
      height: '100%',
      paddingHorizontal: spacing.xs,
      fontSize: font.body,
      color: '#ffffff',
    },
    reset: {
      width: 38,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: '#3d3a4f',
      overflow: 'hidden',
      marginLeft: spacing.sm,
    },
    resetLine: {
      position: 'absolute',
      width: 15,
      height: 2,
      borderRadius: 1,
      backgroundColor: '#c0b9c0',
      transform: [{ rotate: '45deg' }],
    },
    resetLineFlipped: { transform: [{ rotate: '-45deg' }] },
  });

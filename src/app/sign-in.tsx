import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { showErrorAlert } from '@/components/error-alert';
import LanguageButton from '@/components/language-button';
import SoftBlob from '@/components/soft-blob';
import ThemeButton from '@/components/theme-button';
import { LOGO_DATA_URI } from '@/constants/logo';
import { font, spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/context/theme-context';

/**
 * ชุดสีของหน้านี้แยกจาก token ของแอป เพราะการ์ดอาศัยแสงเรืองจากก้อนสี ต้องคุมสีเองทุกชั้น
 * (ดัดแปลงจากดีไซน์ Uiverse ที่เดิมเป็นพื้นดำ ก้อนส้ม/ม่วง)
 * มีสองชุดตามปุ่มสลับโหมดมุมขวาบน เดิมตรึงไว้ชุดมืดชุดเดียว กดสลับแล้วหน้าไม่เปลี่ยน ผู้ใช้นึกว่าปุ่มเสีย
 */
const DARK = {
  /** โทนกรมท่าเดียวกับโหมดมืดของแอป */
  screenBg: '#101A2E',
  card: '#1A2742',
  cardBorder: 'rgba(255,255,255,0.1)',
  /** แผ่นคลุมก้อนแสงให้ขอบละลายไปกับการ์ด ใช้สีเดียวกับพื้นการ์ด */
  overlay: 'rgba(16,26,46,0.35)',
  blobIntensity: 0.8,
  text: '#FFFFFF',
  /** 0.75 แทน 0.6 ของต้นฉบับ ให้ข้อความรองอ่านง่ายขึ้น (9.4:1) */
  textDim: 'rgba(255,255,255,0.75)',
  /** 0.55 ให้ placeholder ผ่าน 4.5:1 (เดิม 0.4 ได้แค่ 3.5:1) */
  placeholder: 'rgba(255,255,255,0.55)',
  fieldBg: 'rgba(255,255,255,0.06)',
  fieldBorder: 'rgba(255,255,255,0.18)',
  logoRingBorder: 'rgba(255,255,255,0.2)',
  shadowOpacity: 0.4,
};

/**
 * โหมดสว่าง: การ์ดขาวบนพื้นเทาอมฟ้า แสงเรืองยังอยู่แต่จางลง ไม่งั้นการ์ดขาวจะดูเลอะ
 * ช่องกรอกใช้พื้นทึบ placeholder จึงได้ contrast คงที่ 4.55:1 ไม่ว่าแสงจะทาบตรงไหน
 */
const LIGHT: typeof DARK = {
  screenBg: '#E8EEF7',
  card: '#FFFFFF',
  cardBorder: '#CBD5E1',
  overlay: 'rgba(255,255,255,0.55)',
  blobIntensity: 0.45,
  text: '#0F172A',
  textDim: '#475569',
  placeholder: '#64748B',
  fieldBg: '#F8FAFC',
  fieldBorder: '#CBD5E1',
  logoRingBorder: '#CBD5E1',
  shadowOpacity: 0.12,
};

type Palette = typeof DARK;

const BLOB_BLUE = '#3B82F6';
const BLOB_CYAN = '#22D3EE';
/** ปุ่มทึบสีน้ำเงิน ตัวอักษรขาวได้ 5.2:1 ใช้ได้ทั้งสองโหมด */
const BUTTON_BG = '#2563EB';
const BUTTON_TEXT = '#FFFFFF';

/** ตรงกับ @keyframes pulseGlow 4s alternate */
const PULSE_MS = 4000;
/** ตรงกับ animation: floatUp 0.8s */
const ENTER_MS = 800;

export default function SignInScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const palette = isDark ? DARK : LIGHT;
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const enter = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    // ก้อนแสงเต้นสลับไปมาไม่รู้จบ ให้หน้าจอไม่นิ่งสนิท
    pulse.value = withRepeat(
      withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [enter, pulse]);

  /** opacity 0 -> 1 พร้อมเลื่อนขึ้น 30px ตาม floatUp ของต้นฉบับ */
  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 30 }],
  }));

  const blobStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + pulse.value * 0.2,
    transform: [{ scale: 0.9 + pulse.value * 0.2 }],
  }));

  async function handleLogin() {
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (e) {
      showErrorAlert(t('signInFailed'), e, t);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.languageCorner, { top: insets.top + spacing.sm }]}>
        <ThemeButton />
        <LanguageButton />
      </View>

      {/*
        KeyboardAvoidingView หดพื้นที่ลงเหลือแค่ส่วนเหนือแป้นพิมพ์ แล้วการ์ดจัดกลางในพื้นที่นั้น
        ทั้งสองช่องและปุ่มเข้าสู่ระบบจึงอยู่เหนือแป้นพิมพ์พร้อมกัน ไม่ใช่แค่ช่องที่กำลังพิมพ์
        ถ้าจอเล็กจนการ์ดล้น ScrollView ยังเลื่อนดูส่วนที่เหลือได้
        ปุ่มเปลี่ยนภาษา/ธีมอยู่นอกตัวนี้ จะได้ไม่เลื่อนตาม
      */}
      <KeyboardAvoidingView behavior="padding" style={styles.avoider}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.card, cardStyle]}>
            {/*
              ก้อนแสงสองก้อน ต้นฉบับใช้ filter: blur(45px) ซึ่ง React Native ไม่มี
              จึงใช้วงกลมสีจางขนาดใหญ่แล้วเอาแผ่นมืดคลุมทับ ให้ขอบก้อนละลายไปกับพื้นการ์ด
            */}
            <Animated.View style={[styles.blobSlotOrange, blobStyle]} pointerEvents="none">
              <SoftBlob color={BLOB_BLUE} size={220} intensity={palette.blobIntensity} />
            </Animated.View>
            <Animated.View style={[styles.blobSlotPurple, blobStyle]} pointerEvents="none">
              <SoftBlob color={BLOB_CYAN} size={260} intensity={palette.blobIntensity} />
            </Animated.View>
            <View style={styles.overlay} pointerEvents="none" />

            <View style={styles.content}>
              <View style={styles.header}>
                <View style={styles.logoRing}>
                  <Image
                    source={{ uri: LOGO_DATA_URI }}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.title}>{t('appName')}</Text>
                <Text style={styles.subtitle}>{t('signInSubtitle')}</Text>
              </View>

              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder={t('emailPlaceholder')}
                placeholderTextColor={palette.placeholder}
                accessibilityLabel={t('emailLabel')}
              />

              <View style={styles.passwordWrap}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  placeholder={t('passwordPlaceholder')}
                  placeholderTextColor={palette.placeholder}
                  accessibilityLabel={t('passwordLabel')}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={spacing.sm}
                  accessibilityRole="button"
                  accessibilityLabel={t(showPassword ? 'hidePassword' : 'showPassword')}>
                  {/* วาดด้วย SVG ชุดเดียวกับไอคอนอื่นในแอป (เส้นหนา 2 ปลายมน) เลี่ยงปัญหา glyph บน Android */}
                  <EyeIcon slashed={!showPassword} color={palette.textDim} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color={BUTTON_TEXT} />
                ) : (
                  <Text style={styles.buttonText}>{t('signIn')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * ลูกตาเปิด = กำลังแสดงรหัสผ่าน, ลูกตามีขีดทับ = ซ่อนอยู่ (แตะเพื่อแสดง)
 * ตอนซ่อนใช้เส้นโค้งที่เว้นช่องให้ขีดพาดผ่าน ขีดจึงไม่ทับเส้นตาจนดูเป็นก้อน
 */
function EyeIcon({ slashed, color }: { slashed: boolean; color: string }) {
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {slashed ? (
        <>
          <Path
            d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
            {...stroke}
          />
          <Line x1={1} y1={1} x2={23} y2={23} {...stroke} />
        </>
      ) : (
        <>
          <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" {...stroke} />
          <Circle cx={12} cy={12} r={3} {...stroke} />
        </>
      )}
    </Svg>
  );
}

const createStyles = (p: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: p.screenBg },
    avoider: { flex: 1 },
    // flexGrow ให้การ์ดจัดกลางในพื้นที่ที่เหลือ ถ้าการ์ดสูงกว่าพื้นที่ก็เลื่อนแทนที่จะถูกบีบ
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    languageCorner: {
      position: 'absolute',
      right: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      zIndex: 10,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: p.card,
      borderRadius: 24,
      paddingVertical: 36,
      paddingHorizontal: 28,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: p.cardBorder,
      // เงาลึกตาม box-shadow ของต้นฉบับ โหมดสว่างเบาลง ไม่งั้นการ์ดขาวดูมีคราบดำรอบ ๆ
      shadowColor: '#000',
      shadowOpacity: p.shadowOpacity,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 16 },
      elevation: 12,
    },
    blobSlotOrange: { position: 'absolute', top: -80, right: -80 },
    blobSlotPurple: { position: 'absolute', bottom: -100, left: -100 },
    overlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: p.overlay,
    },
    content: { zIndex: 10 },
    header: { alignItems: 'center', marginBottom: 28 },
    logoRing: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 1,
      borderColor: p.logoRingBorder,
      // ไฟล์ logo.jpg เป็นโลโก้บนพื้นขาว ไม่มีพื้นโปร่งใส จึงต้องรองพื้นขาวให้กลมกลืน
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    logo: { width: 76, height: 76 },
    title: {
      color: p.text,
      fontSize: font.h2,
      fontWeight: '500',
      letterSpacing: -0.5,
      marginBottom: 6,
      textAlign: 'center',
    },
    subtitle: { color: p.textDim, fontSize: font.small, textAlign: 'center' },
    input: {
      backgroundColor: p.fieldBg,
      borderWidth: 1,
      borderColor: p.fieldBorder,
      borderRadius: 12,
      color: p.text,
      fontSize: font.body,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    passwordWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: p.fieldBg,
      borderWidth: 1,
      borderColor: p.fieldBorder,
      borderRadius: 12,
      paddingRight: 12,
      marginBottom: 24,
    },
    passwordInput: {
      flex: 1,
      color: p.text,
      fontSize: font.body,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    eyeButton: { padding: spacing.xs },
    button: {
      backgroundColor: BUTTON_BG,
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: { color: BUTTON_TEXT, fontSize: font.body, fontWeight: '600' },
  });

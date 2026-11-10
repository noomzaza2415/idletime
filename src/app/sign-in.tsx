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
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { showErrorAlert } from '@/components/error-alert';
import LanguageButton from '@/components/language-button';
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
  /** โปร่งแสง 82% ให้พื้นหลังทะลุขึ้นมาเล็กน้อย ดูเบากว่าการ์ดทึบ */
  card: 'rgba(26,39,66,0.82)',
  cardBorder: 'rgba(255,255,255,0.1)',
  text: '#FFFFFF',
  /** 0.75 แทน 0.6 ของต้นฉบับ ให้ข้อความรองอ่านง่ายขึ้น (9.4:1) */
  textDim: 'rgba(255,255,255,0.75)',
  /** 0.55 ให้ placeholder ผ่าน 4.5:1 (เดิม 0.4 ได้แค่ 3.5:1) */
  placeholder: 'rgba(255,255,255,0.55)',
  fieldBg: 'rgba(255,255,255,0.06)',
  fieldBorder: 'rgba(255,255,255,0.18)',
  logoRingBorder: 'rgba(255,255,255,0.2)',
  logoHaloBorder: 'rgba(96,165,250,0.55)',
  logoHaloBg: 'rgba(59,130,246,0.14)',
  /** สีกลางของแถบแสงที่วิ่งผ่านการ์ด */
  shine: 'rgba(255,255,255,0.13)',
  shadowOpacity: 0.4,
};

/**
 * โหมดสว่าง: การ์ดขาวบนพื้นเทาอมฟ้า แสงเรืองยังอยู่แต่จางลง ไม่งั้นการ์ดขาวจะดูเลอะ
 * ช่องกรอกใช้พื้นทึบ placeholder จึงได้ contrast คงที่ 4.55:1 ไม่ว่าแสงจะทาบตรงไหน
 */
const LIGHT: typeof DARK = {
  screenBg: '#E8EEF7',
  card: 'rgba(255,255,255,0.85)',
  cardBorder: '#CBD5E1',
  text: '#0F172A',
  textDim: '#475569',
  placeholder: '#64748B',
  fieldBg: '#F8FAFC',
  fieldBorder: '#CBD5E1',
  logoRingBorder: '#CBD5E1',
  logoHaloBorder: 'rgba(37,99,235,0.35)',
  logoHaloBg: 'rgba(59,130,246,0.08)',
  /** การ์ดขาว แสงขาววิ่งผ่านจะมองไม่เห็น ใช้ฟ้าอ่อนแทน */
  shine: 'rgba(59,130,246,0.10)',
  shadowOpacity: 0.12,
};

type Palette = typeof DARK;

/** สีเงาเรืองรอบโลโก้ */
const BLOB_BLUE = '#3B82F6';
/** ปุ่มทึบสีน้ำเงิน ตัวอักษรขาวได้ 5.2:1 ใช้ได้ทั้งสองโหมด */
const BUTTON_BG = '#2563EB';
const BUTTON_TEXT = '#FFFFFF';

/** ตรงกับ animation: floatUp 0.8s */
const ENTER_MS = 800;
/** แถบแสงวิ่งผ่านการ์ดใช้เวลาเท่านี้ แล้วพักก่อนวิ่งรอบใหม่ ไม่วิ่งตลอดจนรบกวนการกรอก */
const SHINE_MS = 1600;
const SHINE_PAUSE_MS = 3200;
/** ความกว้างแถบแสง เอียง 20 องศาให้ดูเป็นแสงสะท้อน */
const SHINE_W = 110;

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
  /** 0 = แถบแสงอยู่นอกการ์ดด้านซ้าย, 1 = พ้นขอบขวาไปแล้ว */
  const shine = useSharedValue(0);
  const [cardW, setCardW] = useState(0);
  /** ผู้ใช้ที่ตั้งลดการเคลื่อนไหวในเครื่อง ไม่ต้องเห็นแสงวิ่ง */
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    enter.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
  }, [enter]);

  useEffect(() => {
    if (reduceMotion) return;
    // เริ่มหลังการ์ดลอยขึ้นเสร็จ วิ่งซ้ายไปขวาแล้วกระโดดกลับไปซ้ายตอนพัก (มองไม่เห็นเพราะอยู่นอกการ์ด)
    shine.value = withDelay(
      ENTER_MS,
      withRepeat(
        withSequence(
          withTiming(1, { duration: SHINE_MS, easing: Easing.inOut(Easing.quad) }),
          withDelay(SHINE_PAUSE_MS, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );
  }, [shine, reduceMotion]);

  const shineStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -SHINE_W * 2 + shine.value * (cardW + SHINE_W * 4) },
      { rotate: '20deg' },
    ],
  }));

  /** opacity 0 -> 1 พร้อมเลื่อนขึ้น 30px ตาม floatUp ของต้นฉบับ */
  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 30 }],
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
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            // เว้นที่ให้แถวปุ่มมุมบน จอเล็ก (BT_A2000 480x800) การ์ดสูงเกือบเต็มจอจนปุ่มทับมุมการ์ด
            { paddingTop: insets.top + spacing.sm + CORNER_BUTTON_H + spacing.sm },
          ]}
          keyboardShouldPersistTaps="handled">
          <Animated.View
            style={[styles.card, cardStyle]}
            onLayout={(e) => setCardW(e.nativeEvent.layout.width)}>
            {/*
              ก้อนแสงเรืองในการ์ดเอาออกแล้ว (ผู้ใช้ขอ 2026-11-10) แทนด้วยแถบแสงยาวที่วิ่งผ่านการ์ดเป็นระยะ
              การ์ดมี overflow: hidden แถบที่ยาวเกินการ์ดจึงถูกตัดตามขอบมน
            */}
            {!reduceMotion && cardW > 0 && (
              <Animated.View style={[styles.shine, shineStyle]} pointerEvents="none">
                <LinearGradient
                  colors={['transparent', palette.shine, 'transparent']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.shineFill}
                />
              </Animated.View>
            )}
            <View style={styles.content}>
              <View style={styles.header}>
                {/* กรอบสองชั้น: วงแหวนฟ้าโปร่งด้านนอกเข้ากับแสงเรืองพื้นหลัง วงขาวด้านในรองโลโก้ */}
                <View style={styles.logoHalo}>
                  <View style={styles.logoRing}>
                    <Image
                      source={{ uri: LOGO_DATA_URI }}
                      style={styles.logo}
                      resizeMode="contain"
                    />
                  </View>
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
  const stroke = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
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

/** ความสูงแถวปุ่มธีม/ภาษามุมขวาบน (ปุ่มภาษาสูงสุด 44) */
const CORNER_BUTTON_H = 44;

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
      // ไม่ใช้ elevation: การ์ดโปร่งแสง เงาของ Android จะทะลุขึ้นมาเป็นกรอบสี่เหลี่ยมซ้อนในการ์ด
    },
    /** สูงเกินการ์ดมาก เอียงแล้วยังพาดเต็มความสูงการ์ด */
    shine: {
      position: 'absolute',
      top: '-50%',
      bottom: '-50%',
      left: 0,
      width: SHINE_W,
    },
    shineFill: { flex: 1 },
    content: { zIndex: 10 },
    header: { alignItems: 'center', marginBottom: 28 },
    /** วงแหวนนอก สีฟ้าโปร่งพร้อมเงาเรืองสีเดียวกัน (เงาสีเห็นบน iOS, Android เห็นเป็นวงแหวนอย่างเดียว) */
    logoHalo: {
      width: 96,
      height: 96,
      borderRadius: 48,
      padding: 6,
      borderWidth: 2,
      borderColor: p.logoHaloBorder,
      backgroundColor: p.logoHaloBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      shadowColor: BLOB_BLUE,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 14,
    },
    logoRing: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 1,
      borderColor: p.logoRingBorder,
      // ไฟล์ logo.jpg เป็นโลโก้บนพื้นขาว ไม่มีพื้นโปร่งใส จึงต้องรองพื้นขาวให้กลมกลืน
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    /** เล็กกว่าวงขาว เว้นขอบขาวรอบโลโก้ ไม่ให้ชิดขอบวงจนดูอึดอัด */
    logo: { width: 66, height: 66 },
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

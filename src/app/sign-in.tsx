import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LanguageButton from '@/components/language-button';
import SoftBlob from '@/components/soft-blob';
import ThemeButton from '@/components/theme-button';
import { LOGO_DATA_URI } from '@/constants/logo';
import { font, spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';

/**
 * สีจากดีไซน์ต้นฉบับ (Uiverse) ตรึงไว้ไม่ผูกกับธีมของแอป
 * การ์ดนี้ตั้งอยู่บนพื้นดำและอาศัยแสงเรืองจากก้อนสี ถ้าสลับเป็นธีมสว่างจะไม่เหลืออะไรให้ดู
 */
const CARD = '#0d0f14';
const BLOB_ORANGE = '#ff5e00';
const BLOB_PURPLE = '#7000ff';
const TEXT = '#ffffff';
const TEXT_DIM = 'rgba(255,255,255,0.6)';
const PLACEHOLDER = 'rgba(255,255,255,0.4)';
const FIELD_BG = 'rgba(255,255,255,0.05)';
const FIELD_BORDER = 'rgba(255,255,255,0.12)';

/** ตรงกับ @keyframes pulseGlow 4s alternate */
const PULSE_MS = 4000;
/** ตรงกับ animation: floatUp 0.8s */
const ENTER_MS = 800;

export default function SignInScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(), []);
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
      Alert.alert(t('signInFailed'), e instanceof Error ? e.message : t('tryAgainLong'));
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
        ห่อด้วย KeyboardAwareScrollView เพื่อให้ช่องรหัสผ่านกับปุ่มเข้าสู่ระบบ
        ไม่โดนแป้นพิมพ์บังบนจอเล็ก ปุ่มเปลี่ยนภาษา/ธีมอยู่นอกตัวนี้ จะได้ไม่เลื่อนตาม
      */}
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        bottomOffset={spacing.xl}
        keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.card, cardStyle]}>
          {/*
            ก้อนแสงสองก้อน ต้นฉบับใช้ filter: blur(45px) ซึ่ง React Native ไม่มี
            จึงใช้วงกลมสีจางขนาดใหญ่แล้วเอาแผ่นมืดคลุมทับ ให้ขอบก้อนละลายไปกับพื้นการ์ด
          */}
          <Animated.View style={[styles.blobSlotOrange, blobStyle]} pointerEvents="none">
            <SoftBlob color={BLOB_ORANGE} size={220} intensity={0.8} />
          </Animated.View>
          <Animated.View style={[styles.blobSlotPurple, blobStyle]} pointerEvents="none">
            <SoftBlob color={BLOB_PURPLE} size={260} intensity={0.8} />
          </Animated.View>
          <View style={styles.darkOverlay} pointerEvents="none" />

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
              placeholderTextColor={PLACEHOLDER}
              accessibilityLabel={t('emailLabel')}
            />

            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder={t('passwordPlaceholder')}
                placeholderTextColor={PLACEHOLDER}
                accessibilityLabel={t('passwordLabel')}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={spacing.sm}
                accessibilityRole="button"
                accessibilityLabel={t(showPassword ? 'hidePassword' : 'showPassword')}>
                {/* วาดลูกตาเองด้วย View เหมือนปุ่มอื่นในแอป เลี่ยงปัญหา glyph บน Android */}
                <View style={styles.eye}>
                  <View style={styles.eyeOutline} />
                  <View style={styles.eyePupil} />
                  {!showPassword && <View style={styles.eyeSlash} />}
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={TEXT} />
              ) : (
                <Text style={styles.buttonText}>{t('signIn')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: '#05050a' },
    // flexGrow ให้เนื้อหาที่สั้นกว่าจอยังจัดกลางได้ ส่วนตอนแป้นพิมพ์เปิดจะเลื่อนขึ้นแทนที่จะถูกบีบ
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
      zIndex: 10,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: CARD,
      borderRadius: 24,
      paddingVertical: 36,
      paddingHorizontal: 28,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      // เงาลึกตาม box-shadow ของต้นฉบับ
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 16 },
      elevation: 12,
    },
    blobSlotOrange: { position: 'absolute', top: -80, right: -80 },
    blobSlotPurple: { position: 'absolute', bottom: -100, left: -100 },
    darkOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: 'rgba(5,5,8,0.35)',
    },
    content: { zIndex: 10 },
    header: { alignItems: 'center', marginBottom: 28 },
    logoRing: {
      width: 76,
      height: 76,
      borderRadius: 38,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
      // ไฟล์ icon.png เป็นโลโก้บนพื้นขาว ไม่ได้เจาะโปร่งใส จึงต้องรองพื้นขาวให้กลมกลืน
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginBottom: spacing.md,
    },
    logo: { width: 76, height: 76 },
    title: {
      color: TEXT,
      fontSize: font.h2,
      fontWeight: '500',
      letterSpacing: -0.5,
      marginBottom: 6,
      textAlign: 'center',
    },
    subtitle: { color: TEXT_DIM, fontSize: font.small, textAlign: 'center' },
    input: {
      backgroundColor: FIELD_BG,
      borderWidth: 1,
      borderColor: FIELD_BORDER,
      borderRadius: 12,
      color: TEXT,
      fontSize: font.body,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    passwordWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: FIELD_BG,
      borderWidth: 1,
      borderColor: FIELD_BORDER,
      borderRadius: 12,
      paddingRight: 12,
      marginBottom: 24,
    },
    passwordInput: {
      flex: 1,
      color: TEXT,
      fontSize: font.body,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    eyeButton: { padding: spacing.xs },
    eye: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
    eyeOutline: {
      width: 22,
      height: 14,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: TEXT_DIM,
    },
    eyePupil: {
      position: 'absolute',
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: TEXT_DIM,
    },
    eyeSlash: {
      position: 'absolute',
      width: 26,
      height: 1.5,
      borderRadius: 1,
      backgroundColor: TEXT_DIM,
      transform: [{ rotate: '-45deg' }],
    },
    button: {
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: { color: TEXT, fontSize: font.body, fontWeight: '500' },
  });

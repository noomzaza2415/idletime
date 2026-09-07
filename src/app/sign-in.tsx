import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import LanguageButton from '@/components/language-button';
import ThemeButton from '@/components/theme-button';
import { controlHeight, elevation, font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useColors } from '@/context/theme-context';

export default function SignInScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(c), [c]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (e) {
      Alert.alert(
        t('signInFailed'),
        e instanceof Error ? e.message : t('tryAgainLong')
      );
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

      <Text style={styles.title}>{t('appName')}</Text>
      <Text style={styles.subtitle}>{t('signInSubtitle')}</Text>

      <View style={styles.form}>
        <Text style={styles.label}>{t('emailLabel')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder={t('emailPlaceholder')}
          placeholderTextColor={c.textSecondary}
        />
        <Text style={styles.label}>{t('passwordLabel')}</Text>
        <View style={styles.passwordWrap}>
          <TextInput
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholder={t('passwordPlaceholder')}
            placeholderTextColor={c.textSecondary}
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
            <ActivityIndicator color={c.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>{t('signIn')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
      justifyContent: 'center',
      padding: spacing.xl,
    },
    languageCorner: { position: 'absolute', right: spacing.lg, flexDirection: 'row', alignItems: 'center' },
    title: {
      fontSize: font.h1,
      fontWeight: '700',
      color: c.textPrimary,
      textAlign: 'center',
      // ตั้งที่สไตล์แทนการแก้ค่าใน i18n เพราะ appName ถูกใช้ในเมนูด้วย ซึ่งยังอยากได้ตัวปกติ
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    subtitle: {
      fontSize: font.body,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xs,
      marginBottom: spacing.xxl,
    },
    form: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: c.border,
      ...elevation.card,
    },
    label: {
      fontSize: font.small,
      color: c.textSecondary,
      marginBottom: spacing.sm,
      marginTop: spacing.lg,
      fontWeight: '600',
    },
    input: {
      minHeight: controlHeight,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: font.body,
      color: c.textPrimary,
    },
    /**
     * กรอบย้ายมาอยู่ที่ตัว wrapper และวางปุ่มเป็น sibling ข้าง TextInput
     * เคยวางปุ่มแบบ position: absolute ทับบน TextInput แล้วกดไม่ติดบน Android
     * เพราะ TextInput รับทัชไปก่อน
     */
    passwordWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.sm,
    },
    passwordInput: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: font.body,
      color: c.textPrimary,
    },
    eyeButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    eye: { width: 26, height: 18, alignItems: 'center', justifyContent: 'center' },
    /** ทรงตาแบบ stadium: กว้าง 26 สูง 16 มุมโค้งครึ่งความสูง */
    eyeOutline: {
      position: 'absolute',
      width: 26,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: c.textSecondary,
    },
    eyePupil: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.textSecondary },
    /** ขีดทับ = สถานะซ่อนอยู่ */
    eyeSlash: {
      position: 'absolute',
      width: 30,
      height: 2,
      borderRadius: 1,
      backgroundColor: c.textSecondary,
      transform: [{ rotate: '-45deg' }],
    },
    button: {
      backgroundColor: c.primary,
      borderRadius: radius.sm,
      minHeight: controlHeight,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xl,
      ...elevation.card,
    },
    buttonText: { color: c.onPrimary, fontWeight: '700', fontSize: font.body, letterSpacing: 0.3 },
  });

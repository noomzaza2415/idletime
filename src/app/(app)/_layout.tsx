import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import LanguageButton from '@/components/language-button';
import ThemeButton from '@/components/theme-button';
import {
  COMPACT_WIDTH,
  controlHeight,
  elevation,
  font,
  radius,
  spacing,
  type ThemeColors,
} from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/context/theme-context';

export default function AppLayout() {
  const { logout, userName } = useAuth();
  const { colors: c } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(c), [c]);
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  /**
   * header ฉบับเว็บไม่หักความกว้างปุ่มขวาออกจากหัวเรื่อง จอแคบหัวเรื่องจึงวิ่งไปทับปุ่ม
   * กันที่ไว้ให้ปุ่มซ้าย (≈56) กับปุ่มธีม+ภาษา แล้วตัดหัวเรื่องที่ยาวเกินเป็น … (มือถือ header ของระบบตัดให้เอง)
   */
  const webTitleMaxWidth = width - (width < COMPACT_WIDTH ? 190 : 220);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
  }

  return (
    <>
      {/* หัวจอเป็นสีน้ำเงินทุกโหมด ตัวอักษรแถบสถานะต้องเป็นสีขาว */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          /*
            หัวจอไล่สีน้ำเงิน (ผู้ใช้ขอ 2026-11-10) ตัวอักษร ปุ่มย้อนกลับ และไอคอนบนหัวจอเป็นสีขาว
            ไม่มีเส้นใต้หัวจอ สีพื้นแยกส่วนหัวกับเนื้อหาชัดอยู่แล้ว
          */
          headerBackground: () => (
            <LinearGradient
              colors={[c.headerGradStart, c.headerGradEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            />
          ),
          headerShadowVisible: false,
          headerTitleStyle: { color: '#FFFFFF', fontWeight: '700' },
          headerTintColor: '#FFFFFF',
          contentStyle: { backgroundColor: c.bg },
          ...(Platform.OS === 'web' && {
            headerTitle: ({ children }: { children: string }) => (
              <Text numberOfLines={1} style={[styles.webTitle, { maxWidth: webTitleMaxWidth }]}>
                {children}
              </Text>
            ),
          }),
          headerRight: () => (
            <View style={styles.headerActions}>
              <ThemeButton onDark />
              <LanguageButton onDark />
            </View>
          ),
        }}>
        <Stack.Screen
          name="index"
          options={{
            title: t('headerRecords'),
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => setMenuOpen(true)}
                style={styles.hamburger}
                hitSlop={spacing.sm}>
                {/* วาดเส้นเอง แทนการใช้ตัวอักษร ☰ เพื่อเลี่ยงปัญหา glyph บน Android */}
                <View style={styles.bar} />
                <View style={styles.bar} />
                <View style={styles.bar} />
              </TouchableOpacity>
            ),
          }}
        />
        <Stack.Screen
          name="record/[id]"
          options={({ navigation }) => ({
            title: t('headerRecordDetail'),
            // เปิดจากลิงก์หรือกดรีเฟรชบนเว็บ ไม่มีหน้าก่อนหน้า ปุ่มย้อนกลับของ header จึงไม่ขึ้น
            // ใส่ปุ่มกลับหน้ารายการแทน ไม่งั้นผู้ใช้ติดอยู่หน้านี้
            ...(!navigation.canGoBack() && {
              headerLeft: () => (
                <TouchableOpacity
                  onPress={() => navigation.replace('index')}
                  style={styles.backToList}
                  hitSlop={spacing.sm}
                  accessibilityRole="button"
                  accessibilityLabel={t('headerRecords')}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M19 12H5M12 19l-7-7 7-7"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </TouchableOpacity>
              ),
            }),
          })}
        />
      </Stack>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          {/* กันไม่ให้การแตะในแผงเมนูทะลุไปปิด modal */}
          {/*
            Modal วาดเต็มจอถึงใต้แถบสถานะและแถบนำทาง ต้องเว้นทั้งบนและล่าง
            ไม่งั้นปุ่มออกจากระบบจะจมอยู่ใต้ปุ่มนำทางของ Android
          */}
          <Pressable
            style={[
              styles.panel,
              { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
            ]}>
            <Text style={styles.appName}>{t('appName')}</Text>

            <View style={styles.userBox}>
              <Text style={styles.userLabel}>{t('signedInAs')}</Text>
              <Text style={styles.userName} numberOfLines={2}>
                {userName ?? '-'}
              </Text>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>{t('logout')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      // header ฉบับเว็บไม่เว้นขอบให้ปุ่มที่ใส่เอง ปุ่มจึงชิดขอบจอ มือถือ header ของระบบเว้นให้แล้ว
      ...(Platform.OS === 'web' && { marginRight: spacing.md }),
    },
    hamburger: {
      paddingVertical: spacing.sm,
      paddingRight: spacing.md,
      gap: 5,
      ...(Platform.OS === 'web' && { marginLeft: spacing.md }),
    },
    backToList: {
      paddingVertical: spacing.sm,
      paddingRight: spacing.md,
      ...(Platform.OS === 'web' && { marginLeft: spacing.md }),
    },
    webTitle: { fontSize: font.h2, fontWeight: '700', color: '#FFFFFF' },
    bar: {
      width: 22,
      height: 2,
      borderRadius: 1,
      backgroundColor: '#FFFFFF',
    },
    backdrop: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)' },
    panel: {
      width: '78%',
      maxWidth: 340,
      flex: 1,
      backgroundColor: c.surface,
      paddingHorizontal: spacing.lg,
      ...elevation.raised,
    },
    appName: {
      fontSize: font.h2,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: spacing.xl,
      letterSpacing: 0.3,
    },
    userBox: {
      backgroundColor: c.chipBg,
      borderRadius: radius.md,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    userLabel: { fontSize: font.small, color: c.textSecondary },
    userName: {
      fontSize: font.body,
      fontWeight: '700',
      color: c.primary,
      marginTop: spacing.xs,
    },
    logoutButton: {
      marginTop: 'auto',
      minHeight: controlHeight,
      borderWidth: 1,
      borderColor: c.danger,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutText: { color: c.danger, fontWeight: '700', fontSize: font.body },
  });

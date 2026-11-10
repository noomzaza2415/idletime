import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

// ต้อง import ก่อนหน้าจอใด ๆ ใช้ Alert บนเว็บ (ดูเหตุผลในไฟล์)
import '@/components/alert-polyfill';
import LogoWatermark from '@/components/logo-watermark';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { LanguageProvider } from '@/context/language-context';
import { ThemeProvider, useTheme } from '@/context/theme-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    // KeyboardProvider ต้องอยู่นอกสุด เพราะ KeyboardAwareScrollView ทุกหน้าอ่านค่า
    // ความสูงแป้นพิมพ์จาก context ตัวนี้ ไม่ต้องส่ง prop เรื่อง edge-to-edge เข้าไป
    // ตัวไลบรารีตรวจเจอ react-native-edge-to-edge ของ Expo SDK 57 แล้วตั้งให้เอง
    <KeyboardProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <ThemedRoot />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </KeyboardProvider>
  );
}

function ThemedRoot() {
  const { isDark, colors } = useTheme();

  /**
   * บนเว็บ browser ระบายแถบของตัวเองตามสีพื้นของหน้า (แถบเครื่องมือล่างของ Safari, แถบปุ่มนำทางของ Android)
   * และแถบบนตาม theme-color ถ้าไม่ตั้ง จะเป็นสีขาวตัดกับแอปโหมดมืด
   * ตั้งตามธีมปัจจุบัน สลับมืด/สว่างแล้วแถบเปลี่ยนตาม
   */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.style.backgroundColor = colors.bg;
    document.body.style.backgroundColor = colors.bg;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.surface);
  }, [colors.bg, colors.surface]);

  const navTheme = isDark
    ? {
        ...DarkTheme,
        colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface },
      }
    : {
        ...DefaultTheme,
        colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.surface },
      };

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
      {/*
        ลายน้ำโลโก้ทุกหน้า (ผู้ใช้กำหนด 2026-11-10) วางที่นี่จุดเดียว หน้าที่เพิ่มในอนาคตได้ด้วยอัตโนมัติ
        วางทับเนื้อหาเพราะแถวรายการและการ์ดพื้นทึบ อยู่หลังจะมองไม่เห็น จึงต้องจางมาก และแตะทะลุได้
        โหมดมืดย้อมขาว เพราะสามเหลี่ยมน้ำเงินเข้มของโลโก้กลืนกับพื้นกรมท่า
      */}
      <LogoWatermark opacity={isDark ? 0.025 : 0.03} tintColor={isDark ? '#FFFFFF' : undefined} />
    </NavThemeProvider>
  );
}

/** กันหน้าจอที่ต้องล็อกอินด้วย Stack.Protected — ถ้ายังไม่ล็อกอินจะถูกพาไปหน้า sign-in อัตโนมัติ */
function RootNavigator() {
  const { isLoading, isLoggedIn } = useAuth();

  useEffect(() => {
    // ปล่อยให้ splash ค้างไว้จนกว่าจะอ่าน token จาก storage เสร็จ
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

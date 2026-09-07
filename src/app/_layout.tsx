import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/context/auth-context';
import { LanguageProvider } from '@/context/language-context';
import { ThemeProvider, useTheme } from '@/context/theme-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ThemedRoot />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

function ThemedRoot() {
  const { isDark, colors } = useTheme();

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

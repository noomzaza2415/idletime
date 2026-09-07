import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LanguageButton from '@/components/language-button';
import ThemeButton from '@/components/theme-button';
import { controlHeight, elevation, font, radius, spacing, type ThemeColors } from '@/constants/theme';
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

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTitleStyle: { color: c.textPrimary },
          headerTintColor: c.primary,
          contentStyle: { backgroundColor: c.bg },
          headerRight: () => (
            <View style={styles.headerActions}>
              <ThemeButton />
              <LanguageButton />
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
        <Stack.Screen name="record/[id]" options={{ title: t('headerRecordDetail') }} />
      </Stack>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          {/* กันไม่ให้การแตะในแผงเมนูทะลุไปปิด modal */}
          <Pressable style={[styles.panel, { paddingTop: insets.top + spacing.xl }]}>
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
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    hamburger: { paddingVertical: spacing.sm, paddingRight: spacing.md, gap: 5 },
    bar: {
      width: 22,
      height: 2,
      borderRadius: 1,
      backgroundColor: c.textPrimary,
    },
    backdrop: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.5)' },
    panel: {
      width: '78%',
      maxWidth: 340,
      flex: 1,
      backgroundColor: c.surface,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
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

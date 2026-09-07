import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { PALETTES, type ThemeColors, type ThemeMode } from '@/constants/theme';

const STORAGE_KEY = 'themeMode';

/** โหมดมืดเป็นค่าเริ่มต้นตามที่กำหนด ผู้ใช้สลับเองได้และจำค่าไว้ */
const DEFAULT_MODE: ThemeMode = 'dark';

interface ThemeState {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleMode: () => Promise<void>;
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') setModeState(saved);
    })();
  }, []);

  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggleMode = useCallback(async () => {
    let next: ThemeMode = DEFAULT_MODE;
    setModeState((prev) => {
      next = prev === 'dark' ? 'light' : 'dark';
      return next;
    });
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ mode, colors: PALETTES[mode], isDark: mode === 'dark', setMode, toggleMode }),
    [mode, setMode, toggleMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/** ทางลัดสำหรับคอมโพเนนต์ที่ต้องการแค่ชุดสี */
export function useColors() {
  return useTheme().colors;
}

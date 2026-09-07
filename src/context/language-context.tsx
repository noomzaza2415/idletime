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

import { TRANSLATIONS, type Language, type TranslationKey } from '@/constants/i18n';

const STORAGE_KEY = 'language';

/** อังกฤษเป็นค่าเริ่มต้น ผู้ใช้สลับเป็นไทยเองได้และจำค่าไว้ */
const DEFAULT_LANGUAGE: Language = 'en';

interface LanguageState {
  language: Language;
  t: (key: TranslationKey) => string;
  setLanguage: (language: Language) => Promise<void>;
  toggleLanguage: () => Promise<void>;
}

const LanguageContext = createContext<LanguageState | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved === 'th' || saved === 'en') setLanguageState(saved);
    })();
  }, []);

  const setLanguage = useCallback(async (next: Language) => {
    setLanguageState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  // คำนวณค่าถัดไปนอก updater เพราะ React ไม่เรียก updater ทันทีตอน setState
  // ถ้าไปอ่านค่าจากในนั้น ค่าที่เขียนลง storage จะเป็นค่าเริ่มต้นเสมอ
  const toggleLanguage = useCallback(async () => {
    await setLanguage(language === 'th' ? 'en' : 'th');
  }, [language, setLanguage]);

  const t = useCallback((key: TranslationKey) => TRANSLATIONS[language][key], [language]);

  const value = useMemo(
    () => ({ language, t, setLanguage, toggleLanguage }),
    [language, t, setLanguage, toggleLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

/** ทางลัดสำหรับคอมโพเนนต์ที่ต้องการแค่ฟังก์ชันแปล */
export function useT() {
  return useLanguage().t;
}

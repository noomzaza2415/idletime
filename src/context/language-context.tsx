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
import { Platform } from 'react-native';

import { LANGUAGES, TRANSLATIONS, type Language, type TranslationKey } from '@/constants/i18n';

const STORAGE_KEY = 'language';

/**
 * ไทยเป็นค่าเริ่มต้น เพราะพนักงานส่วนใหญ่เป็นคนไทย
 * ผู้ใช้เลือกอังกฤษหรือเกาหลีเองได้และจำค่าไว้ เครื่องที่เคยเลือกภาษาไว้แล้วจะใช้ค่าเดิม
 */
const DEFAULT_LANGUAGE: Language = 'th';

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
      // รับเฉพาะภาษาที่แอปรู้จัก ค่าแปลกปลอมใน storage จะไม่ทำให้ t() คืน undefined
      if (LANGUAGES.includes(saved as Language)) setLanguageState(saved as Language);
    })();
  }, []);

  // บนเว็บบอก browser ว่าหน้าเป็นภาษาอะไรตามที่เลือกจริง ไม่งั้นยังเป็นค่าตอน build (th)
  // ผลคือตัดคำ/อ่านออกเสียงผิดภาษา เมื่อผู้ใช้สลับเป็นอังกฤษ
  useEffect(() => {
    if (Platform.OS === 'web') document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(async (next: Language) => {
    setLanguageState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  // วนไปภาษาถัดไปตามลำดับใน LANGUAGES ปุ่มหลักใช้แผ่นเลือกภาษาแทนแล้ว เก็บไว้ให้ที่อื่นที่อาจเรียกใช้
  // คำนวณค่าถัดไปนอก updater เพราะ React ไม่เรียก updater ทันทีตอน setState
  // ถ้าไปอ่านค่าจากในนั้น ค่าที่เขียนลง storage จะเป็นค่าเริ่มต้นเสมอ
  const toggleLanguage = useCallback(async () => {
    const next = LANGUAGES[(LANGUAGES.indexOf(language) + 1) % LANGUAGES.length];
    await setLanguage(next);
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

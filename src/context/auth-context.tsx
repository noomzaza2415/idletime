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

import { login as loginApi } from '@/api/idle-time-service';
import {
  clearPendingDeactivation,
  deactivateDeviceOnLogout,
  retryPendingDeactivation,
} from '@/api/notification-preference';

interface AuthState {
  isLoading: boolean;
  isLoggedIn: boolean;
  userName: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const STORAGE_KEYS = ['authToken', 'userName', 'authExpiresAt'];

/** เซสชันมีอายุ 30 วัน เกินจากนี้ต้องล็อกอินใหม่ */
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * วันหมดอายุของเซสชัน = 30 วันนับจากที่ล็อกอิน
 *
 * จงใจไม่สนใจ expiration ที่ auth service ส่งมา เพราะ JWT ของระบบนั้นหมดอายุใน
 * ไม่กี่ชั่วโมง ถ้าเอามาใช้ผู้ใช้จะถูกเด้งออกวันละหลายครั้ง
 *
 * ปลอดภัยเพราะ API ของ Idle Time ไม่ได้ตรวจ token อยู่แล้ว (ดู config.ts)
 * token ที่หมดอายุจึงไม่กระทบการใช้งาน มีไว้เพื่อระบุตัวผู้ใช้เท่านั้น
 */
function resolveExpiry(): number {
  return Date.now() + SESSION_MAX_AGE_MS;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [[, token], [, name], [, expiresAt]] = await AsyncStorage.multiGet(STORAGE_KEYS);
      // เซสชันเก่าที่ยังไม่มี authExpiresAt ถือว่าหมดอายุ เพราะเดาวันล็อกอินเดิมไม่ได้
      const isExpired = !expiresAt || Number(expiresAt) <= Date.now();
      if (token && !isExpired) {
        setIsLoggedIn(true);
        setUserName(name);
      } else {
        if (token) await AsyncStorage.multiRemove(STORAGE_KEYS);
        // ออกจากระบบรอบก่อนตอนเน็ตหลุด ยังไม่ได้ปิดแจ้งเตือนที่ต้นทาง ลองอีกครั้ง
        void retryPendingDeactivation();
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, name } = await loginApi(email, password);
    await clearPendingDeactivation();
    await AsyncStorage.multiSet([
      ['authToken', token],
      ['userName', name],
      ['authExpiresAt', String(resolveExpiry())],
    ]);
    setIsLoggedIn(true);
    setUserName(name);
  }, []);

  const logout = useCallback(async () => {
    // ไม่รอผล — ออกจากระบบต้องเสร็จทันทีแม้เน็ตหลุด ส่วนที่ส่งไม่สำเร็จจะถูกลองใหม่ตอนเปิดแอป
    void deactivateDeviceOnLogout();
    await AsyncStorage.multiRemove(STORAGE_KEYS);
    setIsLoggedIn(false);
    setUserName(null);
  }, []);

  const value = useMemo(
    () => ({ isLoading, isLoggedIn, userName, login, logout }),
    [isLoading, isLoggedIn, userName, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

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
 * วันหมดอายุของเซสชัน = อันที่ถึงก่อนระหว่างเพดาน 30 วัน กับวันหมดอายุที่ auth service ส่งมา
 * ถ้า token หมดอายุก่อน 30 วันอยู่แล้ว การถือ session ต่อก็ไม่มีประโยชน์
 */
function resolveExpiry(serverExpiration: string | null): number {
  const cap = Date.now() + SESSION_MAX_AGE_MS;
  if (!serverExpiration) return cap;
  const fromServer = Date.parse(serverExpiration);
  return Number.isNaN(fromServer) ? cap : Math.min(cap, fromServer);
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
      } else if (token) {
        await AsyncStorage.multiRemove(STORAGE_KEYS);
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, name, expiration } = await loginApi(email, password);
    await AsyncStorage.multiSet([
      ['authToken', token],
      ['userName', name],
      ['authExpiresAt', String(resolveExpiry(expiration))],
    ]);
    setIsLoggedIn(true);
    setUserName(name);
  }, []);

  const logout = useCallback(async () => {
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

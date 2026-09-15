import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { fetchWithTimeout } from '@/api/http';

/**
 * เขียน FCM token ลง Firestore โดยตรง
 *
 * ทำแบบนี้แทนการยิงไปที่ notify-server เพราะ Firestore เป็นบริการของ Google
 * เข้าถึงได้จากเน็ตอะไรก็ได้ มือถือที่อยู่นอกโรงงานจึงลงทะเบียนครั้งแรก
 * หรือต่ออายุ token ที่หมดอายุได้ โดยไม่ต้องเปิด server ออกสู่อินเทอร์เน็ต
 *
 * ใช้ REST API ตรง ๆ ไม่ลง Firebase SDK เพิ่ม เพราะต้องการแค่เขียนเอกสารเดียว
 * การลง SDK เต็มตัวจะเพิ่ม native module ที่ต้องดูแลโดยไม่ได้ใช้ความสามารถอื่นเลย
 */

const SIGN_UP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp';
const REFRESH_URL = 'https://securetoken.googleapis.com/v1/token';
const FIRESTORE_URL = 'https://firestore.googleapis.com/v1';

/** collection ที่ notify-server อ่าน — ต้องตรงกับ FirestoreStore.COLLECTION */
const COLLECTION = 'devices';

/**
 * เก็บตัวตนนิรนามไว้ใช้ซ้ำ
 *
 * ถ้าไม่เก็บ ทุกครั้งที่เปิดแอปจะได้ uid ใหม่ แล้วเขียนเอกสารใหม่ทุกรอบ
 * จนใน Firestore มีเครื่องเดียวกันซ้ำหลายสิบรายการ และเด้งแจ้งเตือนซ้ำตามจำนวนนั้น
 */
const UID_KEY = 'firebaseAnonUid';
const REFRESH_KEY = 'firebaseRefreshToken';

interface FirebaseConfig {
  apiKey: string;
  projectId: string;
}

interface Identity {
  idToken: string;
  uid: string;
}

/**
 * งานขอตัวตนที่กำลังทำอยู่ ใช้ร่วมกันเมื่อมีการเรียกซ้อนกัน
 *
 * hook เรียกลงทะเบียนหลายครั้งตอนเปิดแอป (userName เปลี่ยนจาก null เป็นชื่อจริง)
 * ถ้าปล่อยให้ต่างคนต่างทำ ทุกตัวจะอ่าน AsyncStorage พร้อมกันแล้วไม่เจอ uid
 * จึงสมัครผู้ใช้นิรนามใหม่พร้อมกันหมด ได้เอกสารซ้ำใน Firestore เท่าจำนวนที่เรียก
 */
let identityInFlight: Promise<Identity | null> | null = null;

/** google-services.json อ่านตอน runtime ไม่ได้ จึงคัดค่ามาไว้ที่ extra.firebase ใน app.json */
function readConfig(): FirebaseConfig | null {
  const cfg = Constants.expoConfig?.extra?.firebase as FirebaseConfig | undefined;
  return cfg?.apiKey && cfg?.projectId ? cfg : null;
}

/** แลก refresh token ที่เก็บไว้เป็น idToken ใหม่ เพื่อคง uid เดิม */
async function resumeIdentity(apiKey: string): Promise<Identity | null> {
  const [uid, refreshToken] = await Promise.all([
    AsyncStorage.getItem(UID_KEY),
    AsyncStorage.getItem(REFRESH_KEY),
  ]);
  if (!uid || !refreshToken) return null;

  try {
    const res = await fetchWithTimeout(`${REFRESH_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    });
    if (!res.ok) return null;

    const body = await res.json();
    if (!body?.id_token) return null;

    // เก็บ refresh token ตัวใหม่ไว้ เพราะ Google อาจหมุนเปลี่ยนให้
    if (body.refresh_token) await AsyncStorage.setItem(REFRESH_KEY, body.refresh_token);
    return { idToken: body.id_token, uid };
  } catch {
    return null;
  }
}

/** สร้างตัวตนนิรนามใหม่ ใช้เฉพาะครั้งแรกที่ติดตั้งแอป */
async function createIdentity(apiKey: string): Promise<Identity | null> {
  const res = await fetchWithTimeout(`${SIGN_UP_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!res.ok) return null;

  const body = await res.json();
  if (!body?.idToken || !body?.localId) return null;

  await AsyncStorage.multiSet([
    [UID_KEY, body.localId],
    [REFRESH_KEY, body.refreshToken ?? ''],
  ]);
  return { idToken: body.idToken, uid: body.localId };
}

/**
 * บันทึกเครื่องนี้ลง Firestore ที่ devices/{uid}
 *
 * uid คงเดิมตลอดอายุการติดตั้ง เอกสารจึงถูกเขียนทับที่เดิมเสมอ ไม่เกิดรายการซ้ำ
 * และ security rule จำกัดให้เขียนได้เฉพาะเอกสารของ uid ตัวเองเท่านั้น
 *
 * ล้มเหลวแบบเงียบ — การแจ้งเตือนเป็นของเสริม ไม่ควรทำให้แอปใช้งานไม่ได้
 */
export async function saveDeviceToFirestore(
  token: string,
  userName: string | null,
  /** false = ผู้ใช้ปิดการแจ้งเตือนของเครื่องนี้ไว้ notify-server จะข้ามเครื่องนี้ไป */
  active = true
): Promise<boolean> {
  const config = readConfig();
  if (!config) return false;

  try {
    // ผูกงานไว้ตัวเดียว ผู้เรียกที่ตามมาระหว่างนี้จะได้ผลเดียวกันแทนการสมัครใหม่
    identityInFlight ??= (async () => {
      const resumed = await resumeIdentity(config.apiKey);
      return resumed ?? (await createIdentity(config.apiKey));
    })();

    const auth = await identityInFlight;
    // ล้มเหลวแล้วต้องเคลียร์ เพื่อให้ครั้งหน้าลองใหม่ได้ ไม่ค้างกับผลที่ล้มเหลวตลอดไป
    if (!auth) {
      identityInFlight = null;
      return false;
    }

    const url =
      `${FIRESTORE_URL}/projects/${config.projectId}/databases/(default)/documents/` +
      `${COLLECTION}/${auth.uid}`;

    // Firestore REST ต้องระบุชนิดของทุกค่าเอง ไม่รับ JSON ธรรมดา
    const res = await fetchWithTimeout(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.idToken}`,
      },
      body: JSON.stringify({
        fields: {
          token: { stringValue: token },
          platform: { stringValue: Platform.OS },
          userName: { stringValue: userName ?? '' },
          active: { booleanValue: active },
          updatedAt: { timestampValue: new Date().toISOString() },
        },
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}

import * as Clipboard from 'expo-clipboard';
import { Alert, Platform, ToastAndroid } from 'react-native';

import { describeError } from '@/api/app-error';
import type { TranslationKey } from '@/constants/i18n';

type Translate = (key: TranslationKey) => string;

/**
 * คัดลอกข้อความ error ทั้งก้อน (หัวข้อ + สาเหตุ + ข้อมูลสำหรับ IT) ไปวางในแชตแจ้ง IT ได้ทันที
 * ไม่ต้องถ่ายหน้าจอแล้วพิมพ์ตาม ซึ่งมักพิมพ์ endpoint หรือรหัสผิด
 */
export async function copyErrorText(text: string, t: Translate) {
  await Clipboard.setStringAsync(text);
  // Android แสดง toast ได้ไม่ต้องกดปิด ส่วน iOS ไม่มี toast จึงใช้กล่องแจ้งเตือนสั้น ๆ แทน
  if (Platform.OS === 'android') ToastAndroid.show(t('errorCopied'), ToastAndroid.SHORT);
  else Alert.alert(t('errorCopied'));
}

/**
 * กล่องแจ้ง error มาตรฐานของแอป มีปุ่ม "คัดลอก" คู่กับ "ตกลง"
 * ใช้แทน Alert.alert(title, describeError(...)) ทุกจุด ให้ทุก error คัดลอกได้เหมือนกัน
 */
export function showErrorAlert(title: string, err: unknown, t: Translate) {
  const body = describeError(err, t);
  Alert.alert(title, body, [
    { text: t('copyError'), onPress: () => void copyErrorText(`${title}\n${body}`, t) },
    { text: t('ok') },
  ]);
}

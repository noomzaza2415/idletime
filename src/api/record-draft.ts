import AsyncStorage from '@react-native-async-storage/async-storage';

import { EDITABLE_KEYS, type EditableKey } from '@/api/idle-time-service';
import type { IdleTimeRecord } from '@/types';

/**
 * ร่างที่ผู้ใช้กรอกค้างไว้ในหน้ากรอกสาเหตุ
 *
 * Android ปิดแอปทิ้งได้ทุกเมื่อที่แอปไม่ได้อยู่หน้าจอ โดยเฉพาะตอนเปิดกล้อง
 * บนมือถือ RAM น้อยที่ใช้หน้างาน ถ้าไม่เก็บร่างไว้ ลีดเดอร์ต้องพิมพ์สาเหตุใหม่ทั้งหมด
 * หรือถอดใจไม่กรอก ซึ่งทำให้รายงานขาดข้อมูลตรงจุดที่ระบบนี้มีไว้เก็บ
 */

type EditableValues = Pick<IdleTimeRecord, EditableKey>;

interface RecordDraft {
  savedAt: number;
  /** ค่าในระบบตอนเริ่มกรอก ใช้ตรวจว่ามีคนแก้ชนระหว่างที่แอปถูกปิดไปหรือไม่ */
  base: EditableValues;
  /** ค่าที่ผู้ใช้กรอกไว้ */
  values: EditableValues;
}

const DRAFT_PREFIX = 'recordDraft:';

/** ร่างที่ค้างนานกว่านี้ทิ้งไป เลยกะไปหลายวันแล้ว เอากลับมาจะทำให้งงมากกว่าช่วย */
const DRAFT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

/** รายการที่กำลังถ่ายหรือเลือกรูปให้ อยู่รอดข้ามการที่ Android ปิดแอประหว่างเปิดกล้อง */
const PENDING_PHOTO_KEY = 'pendingPhotoTarget';

export interface PhotoTarget {
  id: string;
  date: string;
}

export function pickEditable(record: IdleTimeRecord): EditableValues {
  const values: Partial<Record<EditableKey, unknown>> = {};
  for (const key of EDITABLE_KEYS) values[key] = record[key];
  return values as EditableValues;
}

/** ทุกฟังก์ชันล้มเหลวแบบเงียบ — ร่างเป็นของเสริม ห้ามทำให้การกรอกหรือบันทึกพัง */
export async function saveDraft(id: string, base: IdleTimeRecord, values: IdleTimeRecord) {
  const draft: RecordDraft = {
    savedAt: Date.now(),
    base: pickEditable(base),
    values: pickEditable(values),
  };
  await AsyncStorage.setItem(DRAFT_PREFIX + id, JSON.stringify(draft)).catch(() => {});
}

export async function loadDraft(id: string): Promise<RecordDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_PREFIX + id);
    if (!raw) return null;
    const draft = JSON.parse(raw) as RecordDraft;
    if (!draft?.values || !draft?.base || Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      await clearDraft(id);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export async function clearDraft(id: string) {
  await AsyncStorage.removeItem(DRAFT_PREFIX + id).catch(() => {});
}

export async function markPendingPhoto(target: PhotoTarget) {
  await AsyncStorage.setItem(PENDING_PHOTO_KEY, JSON.stringify(target)).catch(() => {});
}

export async function clearPendingPhoto() {
  await AsyncStorage.removeItem(PENDING_PHOTO_KEY).catch(() => {});
}

/** มีค่าแปลว่าแอปถูกปิดระหว่างเปิดกล้องหรือคลังภาพ เพราะปกติจะถูกล้างทันทีที่ picker ปิด */
export async function readPendingPhoto(): Promise<PhotoTarget | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_PHOTO_KEY);
    const target = raw ? (JSON.parse(raw) as PhotoTarget) : null;
    return target?.id && target?.date ? target : null;
  } catch {
    return null;
  }
}

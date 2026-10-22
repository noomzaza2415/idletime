import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import {
  deleteRecordPhoto,
  getRecordPhotos,
  type PickedPhoto,
  type RecordPhoto,
} from '@/api/photo-store';
import {
  discardPhoto,
  enqueuePhotos,
  forgetSaved,
  getUploaderState,
  loadUploader,
  reconcileUploader,
  resumeUploader,
  retryPhotos,
  subscribeUploader,
} from '@/api/photo-uploader';

export type PhotoListStatus = 'loading' | 'ready' | 'error';

/**
 * รูปแนบของรายการหนึ่ง รวมรูปบน server กับรูปที่ยังรอส่งในเครื่องไว้ที่เดียว
 *
 * ถ้าโหลดรายการรูปจาก server ไม่สำเร็จ ต้องบอกผู้ใช้ตรง ๆ ห้ามแสดงเป็นรายการว่าง
 * ไม่งั้นลีดเดอร์จะเข้าใจว่ายังไม่มีใครถ่ายไว้ แล้วถ่ายซ้ำหรือเข้าใจผิดว่าไม่มีหลักฐาน
 */
export function useRecordPhotos(
  recordId: string,
  userName: string | null | undefined,
  cdEquip?: string | null
) {
  const [serverPhotos, setServerPhotos] = useState<RecordPhoto[]>([]);
  const [status, setStatus] = useState<PhotoListStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const subscribe = useCallback(
    (listener: () => void) => subscribeUploader(recordId, listener),
    [recordId]
  );
  const uploader = useSyncExternalStore(subscribe, () => getUploaderState(recordId));

  const reload = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    try {
      const [list] = await Promise.all([getRecordPhotos(recordId), loadUploader(recordId)]);
      setServerPhotos(list);
      setStatus('ready');
      reconcileUploader(recordId, list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      setStatus('error');
      // รายการจาก server ไม่ขึ้น แต่รูปที่ค้างส่งในเครื่องยังต้องแสดงให้เห็น
      await loadUploader(recordId).catch(() => {});
    }
    // ส่งต่อใบที่ค้างจากรอบก่อน ถ้ายังต่อ server ไม่ได้ ใบนั้นจะล้มเร็วและรอให้กดส่งใหม่
    resumeUploader(recordId, userName);
  }, [recordId, userName]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** รูปที่ส่งสำเร็จในรอบนี้อาจยังไม่อยู่ในรายการที่โหลดไว้ รวมแล้วตัดใบซ้ำด้วยชื่อไฟล์ */
  const photos = useMemo(() => {
    const seen = new Set(serverPhotos.map((p) => p.fileName));
    return [...serverPhotos, ...uploader.saved.filter((p) => !seen.has(p.fileName))];
  }, [serverPhotos, uploader.saved]);

  const failedCount = uploader.queue.filter((q) => q.error).length;
  /** ยังมีรูปที่กำลังย่อ กำลังส่ง หรือรอคิวส่งอยู่ */
  const uploading =
    uploader.staging > 0 || uploader.queue.some((q) => !q.error) || uploader.activeKey !== null;

  const add = useCallback(
    (picked: PickedPhoto[]) => enqueuePhotos(recordId, picked, userName, cdEquip),
    [recordId, userName, cdEquip]
  );

  const retry = useCallback(
    (key?: string) => retryPhotos(recordId, userName, key),
    [recordId, userName]
  );

  const discard = useCallback((key: string) => discardPhoto(recordId, key), [recordId]);

  const drop = useCallback(
    (fileName: string) => {
      setServerPhotos((prev) => prev.filter((p) => p.fileName !== fileName));
      forgetSaved(recordId, fileName);
    },
    [recordId]
  );

  const remove = useCallback(
    async (photo: RecordPhoto) => {
      await deleteRecordPhoto(recordId, photo.fileName, userName);
      drop(photo.fileName);
    },
    [recordId, userName, drop]
  );

  /**
   * ลบทีละใบ และเอาใบที่ลบสำเร็จออกจากจอทันที
   * ถ้าล้มกลางทาง จอจะเหลือเฉพาะใบที่ยังอยู่บน server จริง ไม่ค้างใบที่ลบไปแล้ว
   */
  const removeAll = useCallback(async () => {
    for (const photo of photos) {
      await deleteRecordPhoto(recordId, photo.fileName, userName);
      drop(photo.fileName);
    }
  }, [photos, recordId, userName, drop]);

  return {
    photos,
    status,
    loadError,
    reload,
    queue: uploader.queue,
    activeKey: uploader.activeKey,
    progress: uploader.progress,
    staging: uploader.staging,
    failedCount,
    uploading,
    add,
    retry,
    discard,
    remove,
    removeAll,
  };
}

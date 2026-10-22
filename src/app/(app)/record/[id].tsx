import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  computeLabourCost,
  diffEditable,
  fetchRecordById,
  RecordConflictError,
  updateRecord,
  type EditableKey,
} from '@/api/idle-time-service';
import { getShiftDateString } from '@/api/idle-rules';
import {
  clearDraft,
  clearPendingPhoto,
  loadDraft,
  markPendingPhoto,
  readPendingPhoto,
  saveDraft,
} from '@/api/record-draft';
import type { QueuedPhoto } from '@/api/photo-queue';
import type { PickedPhoto, RecordPhoto } from '@/api/photo-store';
import { showErrorAlert } from '@/components/error-alert';
import MachineStatusBadge from '@/components/machine-status-badge';
import PhotoUploadCard from '@/components/photo-upload-card';
import type { TranslationKey } from '@/constants/i18n';
import { controlHeight, elevation, font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useColors } from '@/context/theme-context';
import { useRecordPhotos } from '@/hooks/use-record-photos';
import {
  BREAK_TIME_VALUE,
  DEPT_OPTIONS,
  JUDGE_OPTIONS,
  TYPE_OPTIONS,
  VENDOR_OPTIONS,
  type IdleTimeRecord,
} from '@/types';

/**
 * เพดานรูปต่อรายการ ต้องตรงกับ MAX_PHOTOS_PER_RECORD ฝั่ง notify-server
 * (เทสต์ idle-rules-sync.test.js ฟ้องถ้าไม่ตรง)
 * กำหนด 2 รูปตามที่หน้างานใช้จริง คือรูปจุดที่หยุดกับรูปหลังแก้ไข
 */
const MAX_PHOTOS = 2;

/** ความสูงแถบปุ่มบันทึกด้านล่าง (ปุ่ม + ระยะบนล่าง) ไม่รวมแถบ gesture */
const FOOTER_HEIGHT = controlHeight + spacing.md * 2;

/** ส่งขนาดภาพไปด้วย ตัวอัปโหลดจะได้รู้ว่าต้องย่อด้านกว้างหรือด้านสูง */
function toPicked(asset: ImagePicker.ImagePickerAsset): PickedPhoto {
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

/** ชื่อช่องที่ใช้บอกผู้ใช้ตอนมีคนแก้ชน ให้ตรงกับหัวข้อที่เห็นบนหน้าจอ */
const FIELD_LABEL: Record<EditableKey, TranslationKey> = {
  idleTimeIssue: 'idleIssueLabel',
  action: 'actionLabel',
  vendor: 'waitVendor',
  dj: 'waitDJ',
  manPower: 'manPowerLabel',
  type: 'typeLabel',
  judge: 'judgeLabel',
  reason: 'reasonLabel',
  dept: 'deptLabel',
  remark: 'remarkLabel',
};

/** ช่องที่อยู่ในส่วน "ข้อมูลเพิ่มเติม" ต้องกางออกให้เห็นเมื่อมีการแก้ชน */
const MORE_KEYS: EditableKey[] = [
  'vendor',
  'dj',
  'manPower',
  'type',
  'judge',
  'reason',
  'dept',
  'remark',
];

/**
 * ตัวเลือกของ Picker พร้อมค่าปัจจุบันเสมอ
 *
 * ค่าที่เว็บหรือข้อมูลเก่าบันทึกไว้อาจไม่อยู่ในรายการ เช่น ชื่อแผนกที่เลิกใช้แล้ว
 * ถ้าไม่ใส่เพิ่ม Picker จะแสดงเป็น "-- เลือก --" ผู้ใช้จะเข้าใจว่ายังว่าง แล้วเลือกทับของเดิม
 */
function withCurrent(options: string[], value: string) {
  return value && !options.includes(value) ? [value, ...options] : options;
}

export default function RecordDetailScreen() {
  // date ส่งมาจากหน้ารายการ เพื่อให้เปิดรายการของวันย้อนหลังได้ถูกกะ
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const shiftDate = date || getShiftDateString();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { t } = useLanguage();
  const { userName } = useAuth();
  const styles = useMemo(() => createStyles(c), [c]);
  const [record, setRecord] = useState<IdleTimeRecord | null>(null);
  /**
   * ค่าในระบบตอนเริ่มกรอก ใช้หาว่าผู้ใช้แก้ช่องไหน และตรวจว่ามีคนแก้ชนก่อนบันทึก
   * ต้องแยกจาก record เพราะ record เปลี่ยนตามทุกตัวอักษรที่พิมพ์
   */
  const [original, setOriginal] = useState<IdleTimeRecord | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);
  /** รูปบน server รวมกับรูปที่รอส่งในเครื่อง ตัวส่งทำงานต่อได้แม้ออกจากหน้านี้ไปแล้ว */
  const photoState = useRecordPhotos(id, userName, record?.line?.toLowerCase());
  const { photos, queue, staging, uploading, failedCount } = photoState;
  /** ที่ว่างเหลือของรายการนี้ นับรูปที่รอส่งด้วย ไม่งั้นเลือกเกินแล้ว server ปฏิเสธทีหลัง */
  const remaining = Math.max(0, MAX_PHOTOS - photos.length - queue.length - staging);
  /**
   * ผู้ใช้กด "No Break" แล้ว จึงเปลี่ยนไปแสดงช่องพิมพ์แทนปุ่มสองปุ่ม
   *
   * เก็บเป็น state ในหน้าจอเท่านั้น ไม่ได้บันทึกลง backend เหมือนฝั่งเว็บ
   * เพราะเป็นแค่การบอกว่า "ตัดสินใจแล้วว่าไม่ใช่ช่วงพัก" ไม่ใช่ข้อมูลของรายการ
   */
  const [manualEntry, setManualEntry] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // รูปแนบโหลดแยกใน useRecordPhotos ถ้ารูปโหลดไม่ขึ้น การ์ดรูปจะบอกเองพร้อมปุ่มโหลดใหม่
        const found = await fetchRecordById(id, shiftDate);

        if (found) {
          // มีร่างค้างจากรอบที่แอปถูกปิดไป ใช้ค่าตั้งต้นของร่างเป็นฐานตรวจการแก้ชน
          // ถ้าระหว่างนั้นมีคนแก้ช่องเดียวกัน ตอนบันทึกจะถูกถามก่อน ไม่ทับเงียบ ๆ
          const draft = await loadDraft(id);
          setOriginal(draft ? { ...found, ...draft.base } : found);
          setRecord(draft ? { ...found, ...draft.values } : found);
          setDraftRestored(draft !== null);
        }
        setLoading(false);

        // แอปถูกปิดระหว่างถ่ายหรือเลือกรูปให้รายการนี้ ดึงรูปที่ค้างอยู่มาอัปโหลดต่อ
        // เช็ก id ก่อนเสมอ แนบรูปผิดรายการแย่กว่ารูปหาย
        const pending = await readPendingPhoto();
        if (found && pending?.id === id) {
          await clearPendingPhoto();
          const result = await ImagePicker.getPendingResultAsync();
          if (result && 'canceled' in result && !result.canceled) {
            await addPhotos(result.assets.map(toPicked));
          }
        }
      } catch (e) {
        showErrorAlert(t('loadRecordFailed'), e, t);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, shiftDate]);

  /**
   * เก็บร่างทุกครั้งที่หยุดพิมพ์ครู่หนึ่ง และลบทิ้งเมื่อไม่มีอะไรต่างจากในระบบแล้ว
   * หน่วงไว้ไม่ให้เขียน storage ทุกตัวอักษร
   */
  useEffect(() => {
    if (!record || !original) return;
    const timer = setTimeout(() => {
      const changed = Object.keys(diffEditable(original, record)).length > 0;
      void (changed ? saveDraft(id, original, record) : clearDraft(id));
    }, 500);
    return () => clearTimeout(timer);
  }, [id, record, original]);

  /**
   * เข้าคิวส่งรูป ตัดส่วนที่เกินเพดานออกก่อน พร้อมบอกผู้ใช้ว่าใช้กี่รูป
   * ถ้าส่งเกินไป server จะปฏิเสธทีหลัง ผู้ใช้เสียเวลารอแล้วยังไม่รู้ว่ารูปไหนเข้าไม่เข้า
   * ผลการส่งแต่ละใบแสดงบนการ์ดรูป ไม่ขึ้น Alert เพราะส่งต่อได้แม้ออกจากหน้านี้ไปแล้ว
   */
  async function addPhotos(picked: PickedPhoto[]) {
    const accepted = picked.slice(0, remaining);
    if (accepted.length < picked.length) {
      const count = String(accepted.length);
      Alert.alert(
        t('photoLimitTitle').replace('{count}', count),
        t('photoLimitBody').replace('{count}', count).replace('{max}', String(MAX_PHOTOS))
      );
    }
    await photoState.add(accepted);
  }

  function confirmDiscard(item: QueuedPhoto) {
    Alert.alert(t('photoDiscardTitle'), t('photoDiscardBody'), [
      { text: t('photoDiscard'), style: 'destructive', onPress: () => photoState.discard(item.key) },
      { text: t('cancel'), style: 'cancel' },
    ]);
  }

  function confirmRemoveAll() {
    Alert.alert(t('clearAllPhotosTitle'), undefined, [
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            // ลบทีละใบเพราะ server ไม่มีเส้นลบทั้งชุด ใบที่ลบสำเร็จหายจากจอทันที
            await photoState.removeAll();
          } catch (e) {
            showErrorAlert(t('deletePhotoFailed'), e, t);
          }
        },
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  }

  /**
   * เปิดกล้องหรือคลังภาพ โดยจดไว้ก่อนว่ากำลังเลือกรูปให้รายการไหน
   * Android อาจปิดแอประหว่างนั้น พอเปิดกลับมาจะได้พากลับมาแนบรูปให้ถูกรายการ
   */
  async function launchPicker(launch: () => Promise<ImagePicker.ImagePickerResult>) {
    await markPendingPhoto({ id, date: shiftDate });
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await launch();
    } finally {
      await clearPendingPhoto();
    }
    if (!result.canceled) await addPhotos(result.assets.map(toPicked));
  }

  async function takePhoto() {
    if (remaining <= 0) return;
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert(t('cameraDenied'), t('cameraDeniedBody'));
      return;
    }
    await launchPicker(() =>
      ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.6, // ลดขนาดไฟล์ไว้ก่อน เผื่อวันหลังต้องอัปโหลดขึ้น backend
      })
    );
  }

  async function pickFromLibrary() {
    // selectionLimit 0 ของ picker แปลว่าไม่จำกัด ต้องกันไว้ก่อนเปิด
    if (remaining <= 0) return;
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert(t('libraryDenied'), t('libraryDeniedBody'));
      return;
    }
    await launchPicker(() =>
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true, // เลือกทีเดียวได้หลายรูป
        // จำกัดตั้งแต่ตอนเลือก ไม่ให้ผู้ใช้เลือกเกินที่รายการนี้ยังรับได้
        selectionLimit: remaining,
        quality: 0.6,
      })
    );
  }

  function confirmRemovePhoto(photo: RecordPhoto) {
    Alert.alert(t('deletePhotoTitle'), undefined, [
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await photoState.remove(photo);
          } catch (e) {
            showErrorAlert(t('deletePhotoFailed'), e, t);
          }
        },
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  }

  function set<K extends keyof IdleTimeRecord>(key: K, value: IdleTimeRecord[K]) {
    setRecord((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  /**
   * รูปที่ส่งไม่สำเร็จไม่ควรขวางการบันทึกสาเหตุ ซึ่งเป็นข้อมูลหลักของรายการ
   * แต่ต้องบอกให้รู้ว่ายังค้างอยู่ในเครื่อง ไม่งั้นลีดเดอร์จะนึกว่ารูปขึ้นครบแล้ว
   */
  function requestSave() {
    if (failedCount === 0) {
      void handleSave();
      return;
    }
    Alert.alert(
      t('photoUnsentTitle').replace('{count}', String(failedCount)),
      t('photoUnsentBody'),
      [
        { text: t('saveAnyway'), onPress: () => void handleSave() },
        { text: t('cancel'), style: 'cancel' },
      ]
    );
  }

  async function handleSave(overwrite = false) {
    if (!record || !original) return;
    setSaving(true);
    try {
      await updateRecord(original, record, shiftDate, overwrite);
      // ฐานใหม่คือค่าที่เพิ่งบันทึก ตัวเก็บร่างจะเห็นว่าไม่มีอะไรค้างแล้วลบร่างทิ้งเอง
      setOriginal(record);
      await clearDraft(id);
      Alert.alert(t('saveSuccess'), undefined, [{ text: t('ok'), onPress: () => router.back() }]);
    } catch (e) {
      if (e instanceof RecordConflictError) {
        showConflict(e);
      } else {
        showErrorAlert(t('saveFailed'), e, t);
      }
    } finally {
      setSaving(false);
    }
  }

  function formatValue(value: IdleTimeRecord[EditableKey]) {
    if (typeof value === 'boolean') return value ? t('yes') : t('no');
    return value === '' ? '-' : String(value);
  }

  /**
   * บอกผู้ใช้ว่าช่องไหนถูกคนอื่นแก้ไปแล้วและตอนนี้ในระบบเป็นค่าอะไร แล้วให้เลือกเอง
   *
   * "ดูข้อมูลล่าสุด" เอาค่าจากระบบมาใส่เฉพาะช่องที่ชน ช่องอื่นที่ผู้ใช้กรอกไว้ยังอยู่ครบ
   * ผู้ใช้ตรวจแล้วกดบันทึกอีกครั้งได้เลย ส่วน "บันทึกทับ" ใช้เมื่อมั่นใจว่าของตัวเองถูก
   */
  function showConflict(conflict: RecordConflictError) {
    const lines = conflict.fields
      .map((key) => `• ${t(FIELD_LABEL[key])}: ${formatValue(conflict.latest[key])}`)
      .join('\n');

    Alert.alert(t('conflictTitle'), `${t('conflictBody')}\n${lines}`, [
      {
        text: t('conflictOverwrite'),
        style: 'destructive',
        onPress: () => void handleSave(true),
      },
      {
        text: t('conflictUseLatest'),
        onPress: () => {
          const latestValues: Partial<IdleTimeRecord> = {};
          for (const key of conflict.fields) {
            (latestValues as Record<EditableKey, unknown>)[key] = conflict.latest[key];
          }
          setRecord((prev) => (prev ? { ...prev, ...latestValues } : prev));
          setOriginal(conflict.latest);
          if (conflict.fields.includes('idleTimeIssue')) setManualEntry(false);
          if (conflict.fields.some((key) => MORE_KEYS.includes(key))) setShowMore(true);
        },
      },
    ]);
  }

  if (loading) {
    return <ActivityIndicator style={{ marginTop: spacing.xl }} color={c.primary} />;
  }
  if (!record) {
    return <Text style={styles.notFound}>{t('notFound')}</Text>;
  }

  /**
   * ขึ้นปุ่มให้เลือกเมื่อกติกาบอกว่าคาบเกี่ยวเวลาพัก และยังไม่มีใครกรอกสาเหตุไว้
   *
   * ถ้ามีค่าอยู่แล้วต้องแสดงช่องพิมพ์ ไม่งั้นคนที่เปิดมาดูรายการเก่า
   * จะไม่เห็นสิ่งที่ตัวเองเคยกรอกไป
   */
  /** Man Hour/Amount ที่จะถูกเก็บ คิดใหม่ทุกครั้งที่แก้ Man Power */
  const labour = computeLabourCost(record.totalMins, record.manPower);

  const showBreakChoice =
    record.breakRuleType === 'SHOW_BUTTON' && !record.idleTimeIssue && !manualEntry;

  return (
    <View style={styles.container}>
      {/*
        KeyboardAwareScrollView เลื่อนช่องที่กำลังพิมพ์ให้พ้นแป้นพิมพ์ให้เอง
        จำเป็นกับหน้านี้เพราะช่องหมายเหตุอยู่ล่างสุด แป้นพิมพ์บังพอดี
      */}
      <KeyboardAwareScrollView
        style={styles.scroll}
        // เว้นที่เหนือแป้นพิมพ์เท่าแถบปุ่มบันทึกที่ลอยอยู่ ไม่ให้ช่องที่พิมพ์ไปอยู่ใต้ปุ่ม
        bottomOffset={FOOTER_HEIGHT + spacing.md}
        // แตะช่องอื่นได้ในทีเดียวขณะแป้นพิมพ์เปิดอยู่
        // ค่าเริ่มต้นของ ScrollView จะกินการกดครั้งแรกไปปิดแป้นพิมพ์ ต้องกดสองครั้ง
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
        <View style={styles.infoCard}>
          <View style={styles.titleRow}>
            <Text style={styles.workOrder}>{record.workOrder}</Text>
            <Text style={styles.model} numberOfLines={1}>
              {record.modelSuffix}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('lotSizeLabel')}</Text>
              <Text style={styles.infoValue}>{record.lotSize}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('timeLabel')}</Text>
              <Text style={styles.infoValue}>
                {record.startTime} - {record.endTime}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('totalLabel')}</Text>
              <Text style={[styles.infoValue, styles.infoValueHighlight]}>
                {record.totalMins.toFixed(2)} min
              </Text>
            </View>
          </View>
          {/* จุดที่หยุดบอกลีดเดอร์ว่าต้องเดินไปดูเครื่องไหน ข้อมูลเดียวกับคอลัมน์ Stop Point บนเว็บ */}
          {(record.stopPoint !== '' || record.status !== '') && (
            <View style={styles.infoRow}>
              {record.stopPoint !== '' && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>{t('stopPointLabel')}</Text>
                  <Text style={styles.infoValue}>{record.stopPoint}</Text>
                </View>
              )}
              {record.status !== '' && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>{t('statusLabel')}</Text>
                  <MachineStatusBadge status={record.status} />
                </View>
              )}
            </View>
          )}
        </View>

        {draftRestored && <Text style={styles.draftNotice}>{t('draftRestored')}</Text>}

        <PhotoUploadCard
          photos={photos}
          status={photoState.status}
          loadError={photoState.loadError}
          onReload={() => void photoState.reload()}
          queue={queue}
          activeKey={photoState.activeKey}
          progress={photoState.progress}
          staging={staging}
          max={MAX_PHOTOS}
          onTakePhoto={takePhoto}
          onPickLibrary={pickFromLibrary}
          onRemove={confirmRemovePhoto}
          onClearAll={confirmRemoveAll}
          onRetry={photoState.retry}
          onDiscard={confirmDiscard}
        />

        <Text style={styles.fieldLabel}>{t('idleIssueLabel')}</Text>
        {showBreakChoice ? (
          /*
            รายการที่คาบเกี่ยวเวลาพักแบบที่ระบบตัดสินแทนไม่ได้ ให้พนักงานเลือกเอง
            เหมือนฝั่งเว็บ กด Break Time แล้วเติมค่าให้ทันที ไม่ต้องพิมพ์
          */
          <View style={styles.breakChoice}>
            <Text style={styles.breakChoiceHint}>{t('breakChoiceQuestion')}</Text>
            <View style={styles.breakChoiceRow}>
              <TouchableOpacity
                style={[styles.breakButton, styles.breakButtonPrimary]}
                onPress={() => {
                  set('idleTimeIssue', BREAK_TIME_VALUE);
                  set('action', BREAK_TIME_VALUE);
                }}>
                <Text style={styles.breakButtonPrimaryText}>{t('breakTime')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.breakButton}
                onPress={() => setManualEntry(true)}>
                <Text style={styles.breakButtonText}>{t('noBreak')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={record.idleTimeIssue}
              onChangeText={(v) => set('idleTimeIssue', v)}
              placeholder={t('idleIssuePlaceholder')}
              placeholderTextColor={c.textSecondary}
              multiline
            />

            {/* เปลี่ยนใจได้ เฉพาะรายการที่เข้าเงื่อนไขให้เลือกเท่านั้น */}
            {record.breakRuleType === 'SHOW_BUTTON' && (
              <TouchableOpacity
                style={styles.resetChoice}
                onPress={() => {
                  set('idleTimeIssue', '');
                  set('action', '');
                  setManualEntry(false);
                }}>
                <Text style={styles.resetChoiceText}>↺ {t('resetBreakChoice')}</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <Text style={styles.fieldLabel}>{t('actionLabel')}</Text>
        <TextInput
          style={styles.input}
          value={record.action}
          onChangeText={(v) => set('action', v)}
          placeholder={t('actionPlaceholder')}
          placeholderTextColor={c.textSecondary}
          multiline
        />

        <TouchableOpacity
          style={styles.moreToggle}
          onPress={() => setShowMore((v) => !v)}
          activeOpacity={0.7}>
          <Text style={styles.moreToggleText}>{t('moreInfo')}</Text>
          <Text style={styles.moreToggleIcon}>{showMore ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showMore && (
          <View>
            {/*
              แบ่งเป็นสามกลุ่มตามคำถามที่พนักงานต้องตอบ: ใครรับผิดชอบ, เสียแรงงานเท่าไร, ประเมินว่าอะไร
              ข้อมูลที่บันทึกยังเป็นชุดเดิมทุกช่อง เปลี่ยนแค่ลำดับบนจอ
            */}
            <Text style={styles.sectionTitle}>{t('sectionResponsible')}</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('waitVendor')}</Text>
              <Switch value={record.vendor} onValueChange={(v) => set('vendor', v)} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('waitDJ')}</Text>
              <Switch value={record.dj} onValueChange={(v) => set('dj', v)} />
            </View>

            {/*
              วาง Dept ใต้สวิตช์ Vendor ทันที เพราะเปิดสวิตช์แล้วรายการเปลี่ยนเป็นรายชื่อ vendor เหมือนเว็บ
              ถ้าอยู่ไกลกัน พนักงานจะไม่รู้ว่าสองช่องนี้เกี่ยวกัน
            */}
            <Text style={styles.fieldLabel}>{t(record.vendor ? 'deptVendorLabel' : 'deptLabel')}</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={record.dept}
                onValueChange={(v) => set('dept', v)}
                dropdownIconColor={c.textSecondary}
                style={styles.picker}>
                <Picker.Item label={t(record.vendor ? 'selectVendor' : 'selectDept')} value="" />
                {withCurrent(record.vendor ? VENDOR_OPTIONS : DEPT_OPTIONS, record.dept).map((o) => (
                  <Picker.Item key={o} label={o} value={o} />
                ))}
              </Picker>
            </View>

            <Text style={styles.sectionTitle}>{t('sectionLabour')}</Text>
            <Text style={styles.fieldLabel}>{t('manPowerLabel')}</Text>
            <TextInput
              style={styles.input}
              value={record.manPower}
              // หลังบ้านเก็บเป็นจำนวนเต็ม ตัดตัวอักษรอื่นทิ้ง กันกรณีวางข้อความที่มีชื่อคนปนมา
              onChangeText={(v) => set('manPower', v.replace(/[^0-9]/g, ''))}
              placeholder={t('manPowerPlaceholder')}
              placeholderTextColor={c.textSecondary}
              // ค่านี้ใช้คำนวณ Man Hour กับ Amount เปิดแป้นตัวเลขให้เลย ลดโอกาสพิมพ์ตัวอักษรปน
              keyboardType="number-pad"
            />

            {/* แสดงให้เห็นก่อนกดบันทึก ว่าระบบจะเก็บ Man Hour กับ Amount เป็นเท่าไร เหมือนตารางบนเว็บ */}
            <View style={styles.labourBox}>
              <View style={styles.labourRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>{t('manHourLabel')}</Text>
                  <Text style={styles.infoValue}>{labour.manHour}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>{t('amountLabel')}</Text>
                  <Text style={styles.infoValue}>{labour.amountThb.toFixed(2)}</Text>
                </View>
              </View>
              <Text style={styles.labourHint}>{t('labourAutoHint')}</Text>
            </View>

            <Text style={styles.sectionTitle}>{t('sectionAssessment')}</Text>
            <Text style={styles.fieldLabel}>{t('typeLabel')}</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={record.type}
                onValueChange={(v) => set('type', v)}
                dropdownIconColor={c.textSecondary}
                style={styles.picker}>
                <Picker.Item label={t('selectType')} value="" />
                {withCurrent(TYPE_OPTIONS, record.type).map((o) => (
                  <Picker.Item key={o} label={o} value={o} />
                ))}
              </Picker>
            </View>

            {/*
              Judge มีแค่สองค่า ใช้ปุ่มคู่ให้แตะครั้งเดียวจบ แทน dropdown ที่ต้องเปิดแล้วเลือกอีกที
              แตะปุ่มที่เลือกอยู่ซ้ำ = ล้างค่า (เทียบเท่า "-- เลือก --" เดิม)
              ค่าเก่าที่ไม่อยู่ในรายการยังขึ้นเป็นปุ่มเพิ่ม ไม่ให้หายไปเงียบ ๆ
            */}
            <Text style={styles.fieldLabel}>{t('judgeLabel')}</Text>
            <View style={styles.segmentRow}>
              {withCurrent(JUDGE_OPTIONS, record.judge).map((o) => {
                const selected = record.judge === o;
                const fill =
                  o === 'Accept' ? c.statusDoneFill : o === 'Delete' ? c.statusPendingFill : c.primary;
                return (
                  <TouchableOpacity
                    key={o}
                    style={[styles.segment, selected && { backgroundColor: fill, borderColor: fill }]}
                    onPress={() => set('judge', selected ? '' : o)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}>
                    <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                      {selected ? '✓ ' : ''}
                      {o}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>{t('reasonLabel')}</Text>
            <TextInput
              style={styles.input}
              value={record.reason}
              onChangeText={(v) => set('reason', v)}
              placeholder={t('reasonPlaceholder')}
              placeholderTextColor={c.textSecondary}
              multiline
            />

            <Text style={styles.fieldLabel}>{t('remarkLabel')}</Text>
            <TextInput
              style={styles.input}
              value={record.remark}
              onChangeText={(v) => set('remark', v)}
              placeholder={t('remarkPlaceholder')}
              placeholderTextColor={c.textSecondary}
              multiline
            />
          </View>
        )}
      </KeyboardAwareScrollView>

      {/*
        ปุ่มบันทึกติดล่างจอเสมอ ไม่ต้องเลื่อนหาหลังกางข้อมูลเพิ่มเติม
        KeyboardStickyView ยกปุ่มขึ้นตามแป้นพิมพ์ จึงกดบันทึกได้ทันทีขณะพิมพ์อยู่
        ตอนแป้นพิมพ์เปิดเลื่อนลงเท่าระยะแถบ gesture เพราะแป้นพิมพ์บังแถบนั้นอยู่แล้ว
      */}
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
          {/*
            ระหว่างรูปยังส่งไม่เสร็จ ห้ามบันทึก เพราะบันทึกแล้วหน้าจอปิดกลับทันที
            ถ้ารูปล้มหลังจากนั้นผู้ใช้จะไม่เห็น และนึกว่ารูปขึ้นครบแล้ว
          */}
          <TouchableOpacity
            style={[styles.saveButton, uploading && styles.saveButtonWaiting]}
            onPress={requestSave}
            disabled={saving || uploading}>
            {saving ? (
              <ActivityIndicator color={c.onPrimary} />
            ) : uploading ? (
              <View style={styles.saveWaitingRow}>
                <ActivityIndicator color={c.textSecondary} />
                <Text style={styles.saveWaitingText}>{t('photoWaitUpload')}</Text>
              </View>
            ) : (
              <Text style={styles.saveButtonText}>{t('save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scroll: { flex: 1 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  /** หัวกลุ่มในข้อมูลเพิ่มเติม ตัวใหญ่กว่าชื่อช่องและมีเส้นใต้ ให้เห็นว่าเริ่มกลุ่มใหม่ */
  sectionTitle: {
    fontSize: font.body,
    fontWeight: '700',
    color: c.primary,
    marginTop: spacing.xl,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  segmentRow: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    minHeight: controlHeight,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: font.body, fontWeight: '600', color: c.textPrimary },
  segmentTextSelected: { color: c.onStatus, fontWeight: '700' },
  notFound: { textAlign: 'center', marginTop: spacing.xl, color: c.textSecondary },
  draftNotice: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.chipBg,
    color: c.primary,
    fontSize: font.small,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: spacing.lg,
    ...elevation.card,
  },
  // จัดชิด baseline ให้ตัวเล็กนั่งเสมอฐานตัวใหญ่ และให้ model หดได้เมื่อชื่อยาว
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  workOrder: { fontSize: font.h2, fontWeight: '700', color: c.textPrimary },
  model: { fontSize: font.small, color: c.textSecondary, flexShrink: 1 },
  infoRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  infoItem: { flex: 1, alignItems: 'center' },
  infoLabel: { fontSize: font.small, color: c.textSecondary },
  infoValue: { fontSize: font.body, fontWeight: '700', color: c.textPrimary, marginTop: 2 },
  infoValueHighlight: { color: c.danger },
  labourBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.infoBoxBorder,
    backgroundColor: c.chipBg,
  },
  labourRow: { flexDirection: 'row' },
  labourHint: {
    fontSize: font.small,
    color: c.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  fieldLabel: {
    fontSize: font.small,
    fontWeight: '600',
    color: c.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  /** Picker บน Android ใช้ตัวอักษรสีดำเสมอถ้าไม่กำหนด โหมดมืดจึงมองไม่เห็นค่าที่เลือกไว้ */
  picker: { color: c.textPrimary },
  pickerWrap: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.sm,
    backgroundColor: c.surface,
  },
  moreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: controlHeight,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  moreToggleText: { fontSize: font.body, fontWeight: '600', color: c.primary },
  moreToggleIcon: { fontSize: font.small, color: c.primary },
  breakChoice: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.sm,
    backgroundColor: c.surface,
    padding: spacing.md,
  },
  breakChoiceHint: {
    fontSize: font.small,
    color: c.textSecondary,
    marginBottom: spacing.md,
  },
  breakChoiceRow: { flexDirection: 'row', gap: spacing.sm },
  breakButton: {
    flex: 1,
    minHeight: controlHeight,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakButtonPrimary: { backgroundColor: c.primary, borderColor: c.primary },
  breakButtonPrimaryText: { color: c.onPrimary, fontWeight: '700', fontSize: font.body },
  breakButtonText: { color: c.textSecondary, fontWeight: '600', fontSize: font.body },
  resetChoice: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  resetChoiceText: { color: c.primary, fontSize: font.small, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.body,
    backgroundColor: c.surface,
    color: c.textPrimary,
    minHeight: controlHeight,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: controlHeight,
    marginTop: spacing.md,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  switchLabel: { fontSize: font.body, color: c.textPrimary },
  saveButton: {
    backgroundColor: c.primary,
    borderRadius: radius.sm,
    minHeight: controlHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { color: c.onPrimary, fontWeight: '700', fontSize: font.body },
  saveButtonWaiting: { backgroundColor: c.border, shadowOpacity: 0, elevation: 0 },
  saveWaitingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  saveWaitingText: { color: c.textSecondary, fontWeight: '600', fontSize: font.body },
});

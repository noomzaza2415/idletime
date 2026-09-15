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
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
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
import {
  deleteRecordPhoto,
  getRecordPhotos,
  uploadRecordPhotos,
  type PickedPhoto,
  type RecordPhoto,
} from '@/api/photo-store';
import PhotoUploadCard from '@/components/photo-upload-card';
import type { TranslationKey } from '@/constants/i18n';
import { controlHeight, elevation, font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useColors } from '@/context/theme-context';
import { BREAK_TIME_VALUE, DEPT_OPTIONS, TYPE_OPTIONS, type IdleTimeRecord } from '@/types';

/** เพดานรูปต่อรายการ ต้องตรงกับ MAX_PHOTOS_PER_RECORD ฝั่ง notify-server */
const MAX_PHOTOS = 20;

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
  dept: 'deptLabel',
  remark: 'remarkLabel',
};

/** ช่องที่อยู่ในส่วน "ข้อมูลเพิ่มเติม" ต้องกางออกให้เห็นเมื่อมีการแก้ชน */
const MORE_KEYS: EditableKey[] = ['vendor', 'dj', 'manPower', 'type', 'dept', 'remark'];

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
  const [photos, setPhotos] = useState<RecordPhoto[]>([]);
  /** สัดส่วนการอัปโหลด 0-1 เป็น null เมื่อไม่ได้กำลังอัปโหลด */
  const [progress, setProgress] = useState<number | null>(null);
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
        // รูปเก็บที่ notify-server แยกจาก API หลัก เพราะ API หลักยังไม่มี field สำหรับรูป
        // รูปโหลดไม่ขึ้นไม่ควรทำให้ทั้งหน้าล้ม จึงจับ error แยกแล้วปล่อยให้เป็นรายการว่าง
        const [found, savedPhotos] = await Promise.all([
          fetchRecordById(id, shiftDate),
          getRecordPhotos(id).catch((err) => {
            console.warn('โหลดรูปแนบไม่สำเร็จ:', err.message);
            return [];
          }),
        ]);
        setPhotos(savedPhotos);

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
        Alert.alert(t('loadRecordFailed'), e instanceof Error ? e.message : t('tryAgain'));
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

  async function addPhotos(picked: PickedPhoto[]) {
    setProgress(0);
    try {
      const saved = await uploadRecordPhotos(id, picked, userName, setProgress);
      setPhotos((prev) => [...prev, ...saved]);
    } catch (e) {
      Alert.alert(t('uploadPhotoFailed'), e instanceof Error ? e.message : t('tryAgain'));
    } finally {
      setProgress(null);
    }
  }

  function confirmRemoveAll() {
    Alert.alert(t('clearAllPhotosTitle'), undefined, [
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            // ลบทีละใบเพราะ server ไม่มีเส้นลบทั้งชุด ทำแบบนี้ยังปลอดภัยกว่าเพิ่มเส้นลบเป็นกลุ่ม
            for (const photo of photos) await deleteRecordPhoto(id, photo.fileName, userName);
            setPhotos([]);
          } catch (e) {
            Alert.alert(t('deletePhotoFailed'), e instanceof Error ? e.message : t('tryAgain'));
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
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert(t('libraryDenied'), t('libraryDeniedBody'));
      return;
    }
    await launchPicker(() =>
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true, // เลือกทีเดียวได้หลายรูป
        quality: 0.6,
      })
    );
  }

  function choosePhotoSource() {
    Alert.alert(t('addPhotoTitle'), undefined, [
      { text: t('takePhoto'), onPress: takePhoto },
      { text: t('chooseFromLibrary'), onPress: pickFromLibrary },
      { text: t('cancel'), style: 'cancel' },
    ]);
  }

  function confirmRemovePhoto(photo: RecordPhoto) {
    Alert.alert(t('deletePhotoTitle'), undefined, [
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRecordPhoto(id, photo.fileName, userName);
            setPhotos((prev) => prev.filter((p) => p.fileName !== photo.fileName));
          } catch (e) {
            Alert.alert(t('deletePhotoFailed'), e instanceof Error ? e.message : t('tryAgain'));
          }
        },
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  }

  function set<K extends keyof IdleTimeRecord>(key: K, value: IdleTimeRecord[K]) {
    setRecord((prev) => (prev ? { ...prev, [key]: value } : prev));
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
        Alert.alert(t('saveFailed'), e instanceof Error ? e.message : t('tryAgain'));
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
  const showBreakChoice =
    record.breakRuleType === 'SHOW_BUTTON' && !record.idleTimeIssue && !manualEntry;

  return (
    // KeyboardAwareScrollView เลื่อนช่องที่กำลังพิมพ์ให้พ้นแป้นพิมพ์ให้เอง
    // จำเป็นกับหน้านี้เพราะช่องหมายเหตุกับปุ่มบันทึกอยู่ล่างสุด แป้นพิมพ์บังพอดี
    <KeyboardAwareScrollView
      style={styles.container}
      // เว้นที่เหนือแป้นพิมพ์ ไม่ให้ช่องที่พิมพ์อยู่ไปแปะติดขอบแป้นพิมพ์พอดีจนอึดอัด
      bottomOffset={spacing.xl}
      // กดปุ่มบันทึกได้ในทีเดียวขณะแป้นพิมพ์เปิดอยู่
      // ค่าเริ่มต้นของ ScrollView จะกินการกดครั้งแรกไปปิดแป้นพิมพ์ ต้องกดสองครั้ง
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: spacing.lg,
        // edge-to-edge บน Android SDK 57: กันปุ่มบันทึกโดนแถบ gesture ทับ
        paddingBottom: spacing.xl + insets.bottom,
      }}>
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
      </View>

      {draftRestored && <Text style={styles.draftNotice}>{t('draftRestored')}</Text>}

      <PhotoUploadCard
        photos={photos}
        progress={progress}
        max={MAX_PHOTOS}
        onAdd={choosePhotoSource}
        onRemove={confirmRemovePhoto}
        onClearAll={confirmRemoveAll}
        labels={{
          title: t('uploadCardTitle'),
          subtitle: t('uploadCardSubtitle'),
          dropzone: t('uploadDropzone'),
          formats: t('uploadFormats'),
          maxSize: t('uploadMaxSize'),
          used: t('uploadUsed'),
          uploading: t('uploadingPhoto'),
          complete: t('uploadComplete'),
          uploadMore: t('uploadMore'),
          clearAll: t('uploadClearAll'),
        }}
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
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t('waitVendor')}</Text>
            <Switch value={record.vendor} onValueChange={(v) => set('vendor', v)} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t('waitDJ')}</Text>
            <Switch value={record.dj} onValueChange={(v) => set('dj', v)} />
          </View>

          <Text style={styles.fieldLabel}>{t('manPowerLabel')}</Text>
          <TextInput
            style={styles.input}
            value={record.manPower}
            onChangeText={(v) => set('manPower', v)}
            placeholder={t('manPowerPlaceholder')}
            placeholderTextColor={c.textSecondary}
          />

          <Text style={styles.fieldLabel}>{t('typeLabel')}</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={record.type}
              onValueChange={(v) => set('type', v)}
              dropdownIconColor={c.textSecondary}>
              <Picker.Item label={t('selectType')} value="" />
              {TYPE_OPTIONS.map((o) => (
                <Picker.Item key={o} label={o} value={o} />
              ))}
            </Picker>
          </View>

          <Text style={styles.fieldLabel}>{t('deptLabel')}</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={record.dept}
              onValueChange={(v) => set('dept', v)}
              dropdownIconColor={c.textSecondary}>
              <Picker.Item label={t('selectDept')} value="" />
              {DEPT_OPTIONS.map((o) => (
                <Picker.Item key={o} label={o} value={o} />
              ))}
            </Picker>
          </View>

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

      <TouchableOpacity style={styles.saveButton} onPress={() => handleSave()} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={c.onPrimary} />
        ) : (
          <Text style={styles.saveButtonText}>{t('save')}</Text>
        )}
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
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
  fieldLabel: {
    fontSize: font.small,
    fontWeight: '600',
    color: c.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
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
    marginTop: spacing.xxl,
    ...elevation.card,
  },
  saveButtonText: { color: c.onPrimary, fontWeight: '700', fontSize: font.body },
});

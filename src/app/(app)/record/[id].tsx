import { Picker } from '@react-native-picker/picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchRecordById, updateRecord } from '@/api/idle-time-service';
import { getShiftDateString } from '@/api/idle-rules';
import { getRecordPhotos, setRecordPhotos } from '@/api/photo-store';
import { controlHeight, elevation, font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useColors } from '@/context/theme-context';
import { DEPT_OPTIONS, TYPE_OPTIONS, type IdleTimeRecord } from '@/types';

export default function RecordDetailScreen() {
  // date ส่งมาจากหน้ารายการ เพื่อให้เปิดรายการของวันย้อนหลังได้ถูกกะ
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const shiftDate = date || getShiftDateString();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(c), [c]);
  const [record, setRecord] = useState<IdleTimeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        // รูปเก็บแยกในเครื่อง เพราะ API ยังไม่มี field สำหรับรูป
        const [found, savedPhotos] = await Promise.all([
          fetchRecordById(id, shiftDate),
          getRecordPhotos(id),
        ]);
        setRecord(found);
        setPhotos(savedPhotos);
      } catch (e) {
        Alert.alert(t('loadRecordFailed'), e instanceof Error ? e.message : t('tryAgain'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, shiftDate]);

  async function addPhotos(uris: string[]) {
    // กันรูปซ้ำเวลาเลือกไฟล์เดิมจากคลังภาพอีกรอบ
    const next = [...photos, ...uris.filter((u) => !photos.includes(u))];
    setPhotos(next);
    await setRecordPhotos(id, next);
  }

  async function takePhoto() {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert(t('cameraDenied'), t('cameraDeniedBody'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6, // ลดขนาดไฟล์ไว้ก่อน เผื่อวันหลังต้องอัปโหลดขึ้น backend
    });
    if (!result.canceled) await addPhotos(result.assets.map((a) => a.uri));
  }

  async function pickFromLibrary() {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert(t('libraryDenied'), t('libraryDeniedBody'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true, // เลือกทีเดียวได้หลายรูป
      quality: 0.6,
    });
    if (!result.canceled) await addPhotos(result.assets.map((a) => a.uri));
  }

  function choosePhotoSource() {
    Alert.alert(t('addPhotoTitle'), undefined, [
      { text: t('takePhoto'), onPress: takePhoto },
      { text: t('chooseFromLibrary'), onPress: pickFromLibrary },
      { text: t('cancel'), style: 'cancel' },
    ]);
  }

  function confirmRemovePhoto(uri: string) {
    Alert.alert(t('deletePhotoTitle'), undefined, [
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          const next = photos.filter((p) => p !== uri);
          setPhotos(next);
          await setRecordPhotos(id, next);
        },
      },
      { text: t('cancel'), style: 'cancel' },
    ]);
  }

  function set<K extends keyof IdleTimeRecord>(key: K, value: IdleTimeRecord[K]) {
    setRecord((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!record) return;
    setSaving(true);
    try {
      await updateRecord(record.id, record);
      Alert.alert(t('saveSuccess'), undefined, [{ text: t('ok'), onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert(t('saveFailed'), e instanceof Error ? e.message : t('tryAgain'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <ActivityIndicator style={{ marginTop: spacing.xl }} color={c.primary} />;
  }
  if (!record) {
    return <Text style={styles.notFound}>{t('notFound')}</Text>;
  }

  return (
    <ScrollView
      style={styles.container}
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

      <Text style={styles.fieldLabel}>
        {t('sitePhotos')}
        {photos.length > 0 ? ` (${photos.length})` : ''}
      </Text>
      <View style={styles.photoGrid}>
        {photos.map((uri) => (
          <View key={uri} style={styles.thumbWrap}>
            <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
            <TouchableOpacity
              style={styles.thumbRemove}
              onPress={() => confirmRemovePhoto(uri)}
              hitSlop={spacing.sm}>
              <Text style={styles.thumbRemoveText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addPhoto} onPress={choosePhotoSource} activeOpacity={0.7}>
          <Text style={styles.photoIcon}>📷</Text>
          <Text style={styles.photoHint}>{photos.length > 0 ? t('addPhoto') : t('takeOrPickPhoto')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.fieldLabel}>{t('idleIssueLabel')}</Text>
      <TextInput
        style={styles.input}
        value={record.idleTimeIssue}
        onChangeText={(v) => set('idleTimeIssue', v)}
        placeholder={t('idleIssuePlaceholder')}
        placeholderTextColor={c.textSecondary}
        multiline
      />

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

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={c.onPrimary} />
        ) : (
          <Text style={styles.saveButtonText}>{t('save')}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  notFound: { textAlign: 'center', marginTop: spacing.xl, color: c.textSecondary },
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
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumbWrap: {
    width: 104,
    height: 104,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  thumbRemoveText: { color: '#FFFFFF', fontSize: font.small, lineHeight: font.small + 4 },
  addPhoto: {
    // เต็มความกว้างเพื่อให้แตะง่ายและไม่ลอยชิดซ้ายตอนยังไม่มีรูป
    width: '100%',
    height: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.border,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  photoIcon: { fontSize: 26 },
  photoHint: { fontSize: font.small, color: c.textSecondary },
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

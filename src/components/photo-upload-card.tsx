import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { QueuedPhoto } from '@/api/photo-queue';
import type { RecordPhoto } from '@/api/photo-store';
import PhotoViewer from '@/components/photo-viewer';
import { controlHeight, font, radius, spacing, type ThemeColors } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useColors } from '@/context/theme-context';
import type { PhotoListStatus } from '@/hooks/use-record-photos';

interface Props {
  /** รูปที่อยู่บน server แล้ว */
  photos: RecordPhoto[];
  status: PhotoListStatus;
  loadError: string | null;
  onReload: () => void;
  /** รูปที่ยังไม่ได้ขึ้น server ทั้งที่รอส่ง กำลังส่ง และส่งไม่สำเร็จ */
  queue: QueuedPhoto[];
  activeKey: string | null;
  /** ความคืบหน้าของใบที่กำลังส่ง 0-1 */
  progress: number;
  /** จำนวนรูปที่กำลังย่อ ยังไม่เข้าคิว */
  staging: number;
  /** จำนวนรูปสูงสุดต่อรายการ ต้องตรงกับที่ server บังคับไว้ */
  max: number;
  onTakePhoto: () => void;
  onPickLibrary: () => void;
  onRemove: (photo: RecordPhoto) => void;
  onClearAll: () => void;
  /** ไม่ส่ง key = ส่งใหม่ทุกใบที่ล้ม */
  onRetry: (key?: string) => void;
  onDiscard: (item: QueuedPhoto) => void;
}

const GRID_COLUMNS = 3;

/** "20260909_142530_1024_a1b2.jpg" -> "14:25" อ่านง่ายกว่าชื่อไฟล์เต็ม */
function timeOfFile(fileName: string) {
  const t = fileName.slice(9, 13);
  return /^\d{4}$/.test(t) ? `${t.slice(0, 2)}:${t.slice(2, 4)}` : '';
}

function CameraIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8a2 2 0 012-2h2l1.5-2h7L17 6h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={3.5} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

function GalleryIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CloseIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 18L18 6M6 6l12 12"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * การ์ดรูปหน้างาน
 *
 * ลำดับบนการ์ดเรียงตามสิ่งที่ผู้ใช้ต้องรู้ก่อน
 * 1. โหลดรูปไม่ขึ้น บอกตรง ๆ พร้อมปุ่มลองใหม่ ไม่แสดงเป็นว่างเฉย ๆ
 * 2. รูปที่ยังไม่ขึ้น server แสดงเป็นแถวเต็มความกว้าง ใบที่ล้มมีปุ่มส่งใหม่ขนาดใหญ่
 * 3. รูปที่อยู่บน server แล้วเป็นตารางรูปย่อ แตะเพื่อดูเต็มจอ
 * 4. ปุ่มถ่ายรูปกับคลังภาพวางคู่กันบนการ์ดเลย แตะครั้งเดียวถึงกล้อง
 *    เดิมต้องแตะปุ่มก่อนแล้วเลือกจาก Alert ของ Android ซึ่งปุ่มเป็นตัวหนังสือเล็กเรียงซ้อนกัน
 *    ใส่ถุงมือแล้วกดพลาดไปโดน "ยกเลิก" ง่าย และเสียหนึ่งขั้นตอนทุกครั้งที่ถ่าย
 *    ส่วนปุ่มลบทั้งหมดทำเป็นข้อความเล็ก ให้กดพลาดยาก
 *
 * ใช้สีจากธีมทั้งหมด เดิมเป็นชุดสีมืดตายตัวของ Uiverse จึงเป็นกล่องดำกลางจอในโหมดสว่าง
 */
export default function PhotoUploadCard({
  photos,
  status,
  loadError,
  onReload,
  queue,
  activeKey,
  progress,
  staging,
  max,
  onTakePhoto,
  onPickLibrary,
  onRemove,
  onClearAll,
  onRetry,
  onDiscard,
}: Props) {
  const c = useColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(c), [c]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [gridWidth, setGridWidth] = useState(0);

  const total = photos.length + queue.length + staging;
  const full = total >= max;
  const failed = queue.filter((q) => q.error);
  const tileSize =
    gridWidth > 0 ? Math.floor((gridWidth - spacing.sm * (GRID_COLUMNS - 1)) / GRID_COLUMNS) : 0;

  function statusOf(item: QueuedPhoto) {
    if (item.error) return { text: t('photoFailed'), color: c.danger };
    if (item.key === activeKey) {
      // ส่งครบทุก byte แล้วแต่ server ยังไม่ตอบ ถ้าค้างที่ 100% ผู้ใช้จะนึกว่าแอปค้าง
      return progress >= 1
        ? { text: t('photoSaving'), color: c.primary }
        : {
            text: t('photoUploading').replace('{percent}', String(Math.round(progress * 100))),
            color: c.primary,
          };
    }
    return { text: t('photoWaiting'), color: c.textSecondary };
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('uploadCardTitle')}</Text>
          {/* บอกเพดานไว้ตลอด ให้รู้ก่อนถ่ายว่าต้องเลือกมุมที่สำคัญที่สุด */}
          <Text style={styles.limitNote}>
            {t('photoLimitNote').replace('{max}', String(max))}
          </Text>
        </View>
        <View style={[styles.countChip, full && styles.countChipFull]}>
          <Text style={[styles.countText, full && styles.countTextFull]}>
            {total}/{max}
          </Text>
        </View>
      </View>

      {status === 'error' && (
        <View style={styles.errorBox}>
          <View style={styles.errorTextWrap}>
            <Text style={styles.errorTitle}>{t('photoLoadFailed')}</Text>
            {loadError && (
              <Text style={styles.errorDetail} numberOfLines={2}>
                {loadError}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.errorButton} onPress={onReload} activeOpacity={0.8}>
            <Text style={styles.errorButtonText}>{t('photoReload')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'loading' && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={c.primary} />
          <Text style={styles.loadingText}>{t('photoLoading')}</Text>
        </View>
      )}

      {staging > 0 && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={c.primary} />
          <Text style={styles.loadingText}>
            {t('photoPreparing').replace('{count}', String(staging))}
          </Text>
        </View>
      )}

      {queue.map((item) => {
        const s = statusOf(item);
        const active = item.key === activeKey;
        return (
          <View key={item.key} style={[styles.queueRow, item.error && styles.queueRowFailed]}>
            <View style={styles.queueMain}>
              <Image source={{ uri: item.uri }} style={styles.queueThumb} contentFit="cover" />
              <View style={styles.queueText}>
                <Text style={[styles.queueStatus, { color: s.color }]}>{s.text}</Text>
                {item.error ? (
                  <>
                    <Text style={styles.queueDetail} numberOfLines={2}>
                      {item.error}
                    </Text>
                    <Text style={styles.queueHint}>{t('photoKeptHint')}</Text>
                  </>
                ) : (
                  active && (
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.round(Math.min(progress, 1) * 100)}%` },
                        ]}
                      />
                    </View>
                  )
                )}
              </View>
            </View>

            {item.error && (
              <View style={styles.queueActions}>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => onRetry(item.key)}
                  activeOpacity={0.8}>
                  <Text style={styles.retryText}>{t('photoRetry')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.discardButton}
                  onPress={() => onDiscard(item)}
                  activeOpacity={0.8}>
                  <Text style={styles.discardText}>{t('photoDiscard')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {failed.length > 1 && (
        <TouchableOpacity
          style={styles.retryAllButton}
          onPress={() => onRetry()}
          activeOpacity={0.8}>
          <Text style={styles.retryAllText}>
            {t('photoRetryAll').replace('{count}', String(failed.length))}
          </Text>
        </TouchableOpacity>
      )}

      {photos.length > 0 && (
        <View
          style={styles.grid}
          onLayout={(e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width)}>
          {tileSize > 0 &&
            photos.map((photo, i) => (
              <View key={photo.fileName} style={{ width: tileSize, height: tileSize }}>
                <TouchableOpacity
                  style={styles.tile}
                  onPress={() => setViewing(i)}
                  activeOpacity={0.8}
                  accessibilityRole="imagebutton">
                  <Image source={{ uri: photo.url }} style={styles.tileImage} contentFit="cover" />
                  {timeOfFile(photo.fileName) !== '' && (
                    <View style={styles.tileCaption}>
                      <Text style={styles.tileCaptionText}>{timeOfFile(photo.fileName)}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {/* ปุ่มลบ 36dp + hitSlop รวมเป็นเป้ากดราว 48dp และมีกล่องยืนยันก่อนลบเสมอ */}
                <TouchableOpacity
                  style={styles.tileDelete}
                  onPress={() => onRemove(photo)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t('deletePhotoTitle')}>
                  <CloseIcon color="#FFFFFF" size={16} />
                </TouchableOpacity>
              </View>
            ))}
        </View>
      )}

      {status === 'ready' && photos.length === 0 && queue.length === 0 && staging === 0 && (
        <Text style={styles.emptyText}>{t('photoEmpty')}</Text>
      )}

      {full ? (
        <View style={[styles.addButton, styles.addButtonDisabled]}>
          <Text style={styles.addTextDisabled}>
            {t('photoFull').replace('{max}', String(max))}
          </Text>
        </View>
      ) : (
        <View style={styles.addRow}>
          {/* ถ่ายรูปใช้บ่อยกว่า จึงเป็นปุ่มสีหลักและกว้างกว่า */}
          <TouchableOpacity
            style={[styles.addButton, styles.cameraButton]}
            onPress={onTakePhoto}
            activeOpacity={0.85}
            accessibilityRole="button">
            <CameraIcon color={c.onPrimary} />
            <Text style={styles.addText}>{t('takePhoto')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, styles.libraryButton]}
            onPress={onPickLibrary}
            activeOpacity={0.85}
            accessibilityRole="button">
            <GalleryIcon color={c.primary} />
            <Text style={styles.libraryText}>{t('photoLibrary')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {photos.length > 1 && (
        <TouchableOpacity
          style={styles.clearAll}
          onPress={onClearAll}
          hitSlop={spacing.sm}
          accessibilityRole="button">
          <Text style={styles.clearAllText}>{t('uploadClearAll')}</Text>
        </TouchableOpacity>
      )}

      <PhotoViewer
        photos={photos}
        index={viewing}
        onChangeIndex={setViewing}
        onClose={() => setViewing(null)}
      />
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: spacing.md,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerText: { flex: 1, paddingRight: spacing.sm },
    title: { fontSize: font.body, fontWeight: '700', color: c.textPrimary },
    limitNote: { fontSize: font.small, color: c.textSecondary, marginTop: 2 },
    countChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: c.chipBg,
    },
    countChipFull: { backgroundColor: c.badgePendingBg },
    countText: {
      fontSize: font.small,
      fontWeight: '700',
      color: c.primary,
      fontVariant: ['tabular-nums'],
    },
    countTextFull: { color: c.warning },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.danger,
      backgroundColor: c.dangerBg,
    },
    errorTextWrap: { flex: 1 },
    errorTitle: { fontSize: font.small, fontWeight: '700', color: c.danger },
    errorDetail: { fontSize: font.small, color: c.textSecondaryStrong, marginTop: 2 },
    errorButton: {
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.sm,
      backgroundColor: c.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorButtonText: { fontSize: font.small, fontWeight: '700', color: c.onStatus },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    loadingText: { fontSize: font.small, color: c.textSecondary },
    queueRow: {
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bg,
      gap: spacing.md,
    },
    queueRowFailed: { borderColor: c.danger, backgroundColor: c.cardPendingBg },
    queueMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    queueThumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: c.border },
    queueText: { flex: 1, gap: 2 },
    queueStatus: { fontSize: font.body, fontWeight: '700' },
    queueDetail: { fontSize: font.small, color: c.textSecondaryStrong },
    queueHint: { fontSize: font.small, color: c.textSecondary },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.border,
      overflow: 'hidden',
      marginTop: spacing.xs,
    },
    progressFill: { height: '100%', borderRadius: 3, backgroundColor: c.primary },
    queueActions: { flexDirection: 'row', gap: spacing.sm },
    retryButton: {
      flex: 2,
      minHeight: controlHeight - 4,
      borderRadius: radius.sm,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryText: { fontSize: font.body, fontWeight: '700', color: c.onPrimary },
    discardButton: {
      flex: 1,
      minHeight: controlHeight - 4,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    discardText: { fontSize: font.body, fontWeight: '600', color: c.textSecondaryStrong },
    retryAllButton: {
      minHeight: controlHeight - 4,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryAllText: { fontSize: font.body, fontWeight: '700', color: c.primary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tile: { flex: 1, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: c.border },
    tileImage: { flex: 1 },
    tileCaption: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingVertical: 2,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
    },
    tileCaptionText: {
      fontSize: font.small,
      fontWeight: '600',
      color: '#FFFFFF',
      fontVariant: ['tabular-nums'],
    },
    tileDelete: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: { fontSize: font.small, color: c.textSecondary },
    addRow: { flexDirection: 'row', gap: spacing.sm },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: controlHeight,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
    },
    cameraButton: { flex: 3, backgroundColor: c.primary },
    libraryButton: {
      flex: 2,
      borderWidth: 1.5,
      borderColor: c.primary,
      backgroundColor: c.surface,
    },
    addButtonDisabled: { backgroundColor: c.border },
    addText: { fontSize: font.body, fontWeight: '700', color: c.onPrimary },
    libraryText: { fontSize: font.body, fontWeight: '700', color: c.primary },
    addTextDisabled: { fontSize: font.body, fontWeight: '700', color: c.textSecondary },
    clearAll: { alignSelf: 'flex-end', paddingVertical: spacing.xs },
    clearAllText: { fontSize: font.small, fontWeight: '600', color: c.danger },
  });

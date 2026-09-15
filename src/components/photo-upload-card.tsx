import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { RecordPhoto } from '@/api/photo-store';
import PhotoViewer from '@/components/photo-viewer';
import SoftBlob from '@/components/soft-blob';
import { font, spacing } from '@/constants/theme';

/**
 * สีจากดีไซน์ต้นฉบับ (Uiverse) ตรึงไว้ไม่ผูกกับธีมของแอป
 * การ์ดนี้เป็นชุดโทนมืดฟ้าครามทั้งใบ ถ้าดึงสีจากธีมสว่างมาใช้จะเสียคาแรกเตอร์ไปหมด
 */
const SLATE_950 = '#020617';
const SLATE_900 = '#0f172a';
const SLATE_800 = '#1e293b';
const SLATE_700 = '#334155';
const SLATE_400 = '#94a3b8';
const CYAN = '#06b6d4';
const SKY = '#0ea5e9';
const EMERALD = '#10b981';
const WHITE = '#ffffff';

/** เส้นรอบวงของวงกลม r=16 ใน viewBox 36 ตรงกับ stroke-dasharray="100" ของต้นฉบับ */
const RING_LENGTH = 100;

interface Props {
  photos: RecordPhoto[];
  /** สัดส่วนการอัปโหลด 0-1 เป็น null เมื่อไม่ได้กำลังอัปโหลด */
  progress: number | null;
  /** จำนวนรูปสูงสุดต่อรายการ ต้องตรงกับที่ server บังคับไว้ */
  max: number;
  onAdd: () => void;
  onRemove: (photo: RecordPhoto) => void;
  onClearAll: () => void;
  labels: {
    title: string;
    subtitle: string;
    dropzone: string;
    formats: string;
    maxSize: string;
    used: string;
    uploading: string;
    complete: string;
    uploadMore: string;
    clearAll: string;
  };
}

/** 1843200 -> "1.8 MB" */
function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** "20260909_142530_1024_a1b2.jpg" -> "14:25:30" อ่านง่ายกว่าชื่อไฟล์เต็ม */
function timeOfFile(fileName: string) {
  const t = fileName.slice(9, 15);
  return /^\d{6}$/.test(t) ? `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}` : fileName;
}

/** ไอคอนอัปโหลดแบบก้อนเมฆ ใช้ path เดียวกับ heroicons ในดีไซน์ต้นฉบับ */
function UploadIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** ไอคอนรูปภาพ ใช้แทนไอคอนเอกสารของต้นฉบับ เพราะที่นี่แนบได้แต่รูป */
function PhotoIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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

function CheckIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 13l4 4L19 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CloseIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 18L18 6M6 6l12 12"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * การ์ดแนบรูปหน้างาน แปลงจากดีไซน์ Upload Files ของ Uiverse
 *
 * ส่วนที่ปรับให้เข้ากับงานจริง
 * - dropzone ของเว็บใช้ลากไฟล์มาวาง บนมือถือไม่มีการลากไฟล์ จึงเปลี่ยนเป็นแตะเพื่อเปิดกล้องหรือคลังภาพ
 * - แถบ Storage Used ของต้นฉบับนับพื้นที่เก็บ ที่นี่ไม่มีโควตาต่อผู้ใช้
 *   จึงเปลี่ยนไปนับจำนวนรูปต่อรายการแทน ซึ่งมีเพดานจริงที่ server บังคับไว้
 * - แถวไฟล์ของต้นฉบับโชว์ไอคอนตามชนิดไฟล์ ที่นี่โชว์รูปย่อจริงเพราะมีอยู่แล้วและอ่านง่ายกว่า
 */
export default function PhotoUploadCard({
  photos,
  progress,
  max,
  onAdd,
  onRemove,
  onClearAll,
  labels,
}: Props) {
  const styles = useMemo(() => createStyles(), []);
  const ratio = Math.min(photos.length / max, 1);
  const percent = Math.round(ratio * 100);
  const uploading = progress !== null;
  /** ปิดการเพิ่มรูปทั้งตอนกำลังส่งและตอนเต็มเพดานแล้ว */
  const addDisabled = uploading || photos.length >= max;
  /** มีรูปแล้วให้ย่อกรอบเส้นประลง เพื่อไม่ให้การ์ดกินพื้นที่จอมากเกินไป */
  const compact = photos.length > 0;
  /** ตำแหน่งรูปที่กำลังเปิดดูเต็มจอ เป็น null เมื่อยังไม่ได้เปิด */
  const [viewing, setViewing] = useState<number | null>(null);

  return (
    <View style={styles.card}>
      {/* ก้อนแสงมุมบนซ้ายและล่างขวา ต้นฉบับใช้ blur-2xl ที่ RN ไม่มี จึงซ้อนวงจางแทน */}
      <View style={styles.blobTop} pointerEvents="none">
        <SoftBlob color={CYAN} size={200} intensity={0.7} />
      </View>
      <View style={styles.blobBottom} pointerEvents="none">
        <SoftBlob color={SKY} size={200} intensity={0.7} />
      </View>

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{labels.title}</Text>
          <Text style={styles.subtitle}>{labels.subtitle}</Text>
        </View>
        <View style={styles.headerIcon}>
          <UploadIcon size={24} color={CYAN} />
        </View>
      </View>

      {/*
        กรอบเส้นประ แตะที่ไหนก็ได้เพื่อเปิดกล้องหรือคลังภาพ

        ตอนยังไม่มีรูปแสดงแบบเต็มพร้อมคำอธิบาย เพราะเป็นสิ่งแรกที่ต้องสะดุดตา
        พอแนบรูปแล้วย่อเหลือแถวเดียว ไม่งั้นการ์ดจะยาวจนต้องเลื่อนหาช่องกรอกสาเหตุ
      */}
      <TouchableOpacity
        style={[compact ? styles.dropzoneCompact : styles.dropzone, addDisabled && styles.disabled]}
        onPress={onAdd}
        activeOpacity={0.8}
        disabled={addDisabled}>
        <View style={compact ? styles.dropIconRingSmall : styles.dropIconRing}>
          <PhotoIcon size={compact ? 22 : 36} color={CYAN} />
        </View>
        <Text style={compact ? styles.dropTitleCompact : styles.dropTitle}>{labels.dropzone}</Text>
        {!compact && (
          <Text style={styles.dropHint}>
            {labels.formats} • {labels.maxSize}
          </Text>
        )}
      </TouchableOpacity>

      {/* แถวที่กำลังอัปโหลด พร้อมแถบความคืบหน้าจริงจากจำนวน byte ที่ส่งไปแล้ว */}
      {uploading && (
        <View style={styles.row}>
          <View style={styles.rowMain}>
            <View style={styles.rowIcon}>
              <PhotoIcon size={24} color={CYAN} />
            </View>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{labels.uploading}</Text>
              <Text style={styles.rowMeta}>{Math.round((progress ?? 0) * 100)}%</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={[CYAN, SKY]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${Math.round((progress ?? 0) * 100)}%` }]}
            />
          </View>
        </View>
      )}

      {photos.map((photo, i) => (
        <View key={photo.fileName} style={styles.row}>
          <TouchableOpacity
            style={styles.rowMain}
            onPress={() => setViewing(i)}
            activeOpacity={0.7}
            accessibilityRole="imagebutton">
            <Image source={{ uri: photo.url }} style={styles.thumb} contentFit="cover" />
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>{timeOfFile(photo.fileName)}</Text>
              <Text style={styles.rowMeta}>
                {formatSize(photo.size)}
                {photo.userName ? ` • ${photo.userName}` : ''}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.rowActions}>
            <CheckIcon size={18} color={EMERALD} />
            <Text style={styles.completeText}>{labels.complete}</Text>
            <TouchableOpacity onPress={() => onRemove(photo)} hitSlop={spacing.sm}>
              <CloseIcon size={18} color={SLATE_400} />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* วงแหวนนับจำนวนรูป แทนแถบพื้นที่เก็บของต้นฉบับ */}
      <View style={styles.usedBox}>
        <View>
          <Text style={styles.usedLabel}>{labels.used}</Text>
          <View style={styles.usedNumbers}>
            <Text style={styles.usedBig}>{photos.length}</Text>
            <Text style={styles.usedSmall}>/ {max}</Text>
          </View>
        </View>

        <View style={styles.ringWrap}>
          <Svg width={48} height={48} viewBox="0 0 36 36">
            <Circle cx={18} cy={18} r={16} fill="none" stroke={SLATE_800} strokeWidth={2} />
            <Circle
              cx={18}
              cy={18}
              r={16}
              fill="none"
              stroke={CYAN}
              strokeWidth={2}
              strokeDasharray={RING_LENGTH}
              // เริ่มวาดจากบนสุดตามหมุน -90 องศาของต้นฉบับ
              strokeDashoffset={RING_LENGTH * (1 - ratio)}
              transform="rotate(-90 18 18)"
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.ringText}>{percent}%</Text>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.primaryButton, addDisabled && styles.disabled]}
          onPress={onAdd}
          activeOpacity={0.85}
          disabled={addDisabled}>
          <LinearGradient
            colors={[CYAN, SKY]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryFill}
          />
          <View style={styles.primaryInner}>
            <Text style={styles.primaryText}>{labels.uploadMore}</Text>
            <UploadIcon size={16} color={WHITE} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, photos.length === 0 && styles.disabled]}
          onPress={onClearAll}
          activeOpacity={0.85}
          disabled={photos.length === 0}>
          <Text style={styles.secondaryText}>{labels.clearAll}</Text>
        </TouchableOpacity>
      </View>

      <PhotoViewer
        photos={photos}
        index={viewing}
        onChangeIndex={setViewing}
        onClose={() => setViewing(null)}
      />
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    card: {
      backgroundColor: SLATE_950,
      borderRadius: 16,
      padding: spacing.md,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 10,
    },
    blobTop: { position: 'absolute', top: -100, left: -100 },
    blobBottom: { position: 'absolute', bottom: -100, right: -100 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerText: { flex: 1, paddingRight: spacing.sm },
    title: { color: WHITE, fontSize: font.body, fontWeight: '600' },
    subtitle: { color: SLATE_400, fontSize: font.small, marginTop: 2 },
    headerIcon: { backgroundColor: 'rgba(6,182,212,0.1)', borderRadius: 8, padding: 8 },
    dropzone: {
      marginTop: spacing.md,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: SLATE_700,
      backgroundColor: 'rgba(15,23,42,0.5)',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
    },
    dropzoneCompact: {
      marginTop: spacing.md,
      borderRadius: 12,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: SLATE_700,
      backgroundColor: 'rgba(15,23,42,0.5)',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dropIconRing: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: SLATE_900,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    dropIconRingSmall: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: SLATE_900,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dropTitleCompact: { color: WHITE, fontSize: font.body - 1, fontWeight: '500' },
    dropTitle: { color: WHITE, fontSize: font.body, fontWeight: '500', textAlign: 'center' },
    dropHint: { color: SLATE_400, fontSize: font.small - 1, marginTop: 4, textAlign: 'center' },
    row: {
      marginTop: spacing.sm,
      backgroundColor: 'rgba(15,23,42,0.5)',
      borderRadius: 12,
      padding: spacing.md,
    },
    rowMain: { flexDirection: 'row', alignItems: 'center' },
    rowIcon: { backgroundColor: 'rgba(6,182,212,0.1)', borderRadius: 8, padding: 8 },
    thumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: SLATE_800 },
    rowTextWrap: { flex: 1, marginLeft: spacing.sm },
    rowTitle: { color: WHITE, fontSize: font.body - 1, fontWeight: '500' },
    rowMeta: { color: SLATE_400, fontSize: font.small - 1, marginTop: 2 },
    rowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    completeText: { color: EMERALD, fontSize: font.small, fontWeight: '500', marginRight: spacing.xs },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: SLATE_800,
      overflow: 'hidden',
      marginTop: spacing.sm,
    },
    progressFill: { height: '100%', borderRadius: 2 },
    usedBox: {
      marginTop: spacing.sm,
      backgroundColor: 'rgba(15,23,42,0.5)',
      borderRadius: 12,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    usedLabel: { color: WHITE, fontSize: font.small, fontWeight: '500' },
    usedNumbers: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 4 },
    usedBig: { color: WHITE, fontSize: font.h2, fontWeight: '700', lineHeight: font.h2 + 2 },
    usedSmall: { color: SLATE_400, fontSize: font.small },
    ringWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    ringText: { position: 'absolute', color: WHITE, fontSize: font.small - 1, fontWeight: '500' },
    buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    primaryButton: { flex: 1, borderRadius: 12, overflow: 'hidden', padding: 1 },
    primaryFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    primaryInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderRadius: 11,
      backgroundColor: 'rgba(2,6,23,0.5)',
      paddingVertical: 10,
    },
    primaryText: { color: WHITE, fontSize: font.body - 1, fontWeight: '500' },
    secondaryButton: {
      flex: 1,
      borderRadius: 12,
      backgroundColor: SLATE_900,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 11,
    },
    secondaryText: { color: WHITE, fontSize: font.body - 1, fontWeight: '500' },
    disabled: { opacity: 0.4 },
  });

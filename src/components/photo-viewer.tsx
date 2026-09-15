import { Image } from 'expo-image';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import type { RecordPhoto } from '@/api/photo-store';
import { font, spacing } from '@/constants/theme';

const WHITE = '#ffffff';
const DIM = 'rgba(255,255,255,0.7)';

interface Props {
  photos: RecordPhoto[];
  /** ตำแหน่งรูปที่กำลังเปิด เป็น null เมื่อปิดอยู่ */
  index: number | null;
  onChangeIndex: (next: number) => void;
  onClose: () => void;
}

function Chevron({ direction, color }: { direction: 'left' | 'right'; color: string }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
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
 * หน้าต่างดูรูปเต็มจอ
 *
 * รูปที่ย่อไว้ 1600 pixel ยังใหญ่พอให้ซูมดูรายละเอียดหน้างานได้ การเปิดเต็มจอ
 * จึงมีประโยชน์จริง ไม่ใช่แค่ขยายภาพย่อ
 *
 * ปุ่มย้อนกลับของเครื่องปิดหน้าต่างนี้ได้ด้วย onRequestClose ซึ่งจำเป็นบน Android
 * ไม่งั้นผู้ใช้กดย้อนกลับแล้วจะหลุดออกจากหน้ารายละเอียดไปเลย
 */
export default function PhotoViewer({ photos, index, onChangeIndex, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const photo = index !== null ? photos[index] : undefined;
  if (!photo) return null;

  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < photos.length - 1;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.counter}>
            {(index ?? 0) + 1} / {photos.length}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={spacing.md} accessibilityRole="button">
            <CloseIcon color={WHITE} />
          </TouchableOpacity>
        </View>

        {/* แตะที่พื้นหลังเพื่อปิด เป็นท่าที่คนคุ้นจากแอปดูรูปทั่วไป */}
        <TouchableOpacity style={styles.imageArea} activeOpacity={1} onPress={onClose}>
          <Image source={{ uri: photo.url }} style={styles.image} contentFit="contain" />
        </TouchableOpacity>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity
            onPress={() => hasPrev && onChangeIndex((index ?? 0) - 1)}
            disabled={!hasPrev}
            hitSlop={spacing.md}>
            <Chevron direction="left" color={hasPrev ? WHITE : 'rgba(255,255,255,0.25)'} />
          </TouchableOpacity>

          <Text style={styles.caption} numberOfLines={1}>
            {photo.fileName}
          </Text>

          <TouchableOpacity
            onPress={() => hasNext && onChangeIndex((index ?? 0) + 1)}
            disabled={!hasNext}
            hitSlop={spacing.md}>
            <Chevron direction="right" color={hasNext ? WHITE : 'rgba(255,255,255,0.25)'} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ทึบสนิท ไม่ใช้สีโปร่ง เพราะตัวหนังสือของหน้าที่อยู่ข้างหลังจะทะลุมากวนสายตา
  backdrop: { flex: 1, backgroundColor: '#000000' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  counter: { color: WHITE, fontSize: font.body, fontWeight: '500' },
  imageArea: { flex: 1 },
  image: { width: '100%', height: '100%' },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  caption: { flex: 1, color: DIM, fontSize: font.small, textAlign: 'center' },
});

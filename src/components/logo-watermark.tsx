import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

/** ลายน้ำกว้างกี่เท่าของด้านสั้นของจอ (ผู้ใช้ขอใหญ่ขึ้นเป็น 1.7 แล้วขอเล็กลงหน่อย 2026-11-10) */
const WATERMARK_SCALE = 1.3;
/** สัดส่วนของไฟล์ assets/images/dongjin-watermark.png (412×451) */
const ASPECT = 451 / 412;

interface Props {
  opacity: number;
  /**
   * ย้อมทั้งโลโก้เป็นสีเดียว ใช้ในโหมดมืด เพราะสามเหลี่ยมน้ำเงินเข้มของโลโก้กลืนกับพื้นกรมท่า
   * ไม่ส่ง = ใช้สีจริงของโลโก้
   */
  tintColor?: string;
}

/**
 * ลายน้ำโลโก้ดองจินขนาดใหญ่กลางจอ วางครั้งเดียวที่ src/app/_layout.tsx ทับทุกหน้า
 *
 * ไฟล์แปลงพื้นขาวของ public/icons/โลโก้ดองจิน (1).jpg ให้โปร่งใสแล้ว ไม่งั้นเห็นเป็นกรอบขาวบนพื้นมืด
 * ขนาดคิดเป็นพิกเซลจากด้านสั้นของจอ เพราะความกว้างแบบ % ที่เกิน 100 ถูกจำกัดไว้แค่ความกว้างจอ
 * แตะทะลุได้ และ screen reader ข้าม
 */
export default function LogoWatermark({ opacity, tintColor }: Props) {
  const { width, height } = useWindowDimensions();
  const w = Math.min(width, height) * WATERMARK_SCALE;
  return (
    <View
      style={styles.wrap}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Image
        source={require('../../assets/images/dongjin-watermark.png')}
        style={{ width: w, height: w * ASPECT, opacity, tintColor }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

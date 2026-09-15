import { View } from 'react-native';

/**
 * จำนวนวงซ้อน ยิ่งมากขอบยิ่งนุ่มแต่ก็วาดหนักขึ้น
 * ต่ำกว่านี้จะเห็นเป็นวงเป็นชั้น ๆ ชัดโดยเฉพาะกับสีอุ่นอย่างส้ม
 */
const LAYERS = 18;

interface Props {
  color: string;
  /** เส้นผ่านศูนย์กลางของวงนอกสุด */
  size: number;
  /** ความทึบรวมโดยประมาณ ยิ่งมากยิ่งสว่าง */
  intensity?: number;
}

/**
 * ก้อนแสงขอบนุ่ม
 *
 * ดีไซน์ต้นทางใช้ filter: blur() ซึ่ง React Native ไม่มีสำหรับ element ของตัวเอง
 * จึงซ้อนวงกลมสีจางหลายวงไล่ขนาดจากใหญ่ไปเล็ก ความทึบสะสมเข้มขึ้นตรงกลาง
 * และจางหายที่ขอบ ให้ผลใกล้เคียงการเบลอโดยไม่ต้องพึ่งไลบรารีเพิ่ม
 */
export default function SoftBlob({ color, size, intensity = 0.8 }: Props) {
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {Array.from({ length: LAYERS }).map((_, i) => {
        const d = size * (1 - i / LAYERS);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: (size - d) / 2,
              top: (size - d) / 2,
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: color,
              opacity: intensity / LAYERS,
            }}
          />
        );
      })}
    </View>
  );
}

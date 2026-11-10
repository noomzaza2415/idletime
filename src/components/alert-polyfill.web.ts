import { Alert, type AlertButton } from 'react-native';

/**
 * ทำให้ Alert.alert ใช้ได้บนเว็บ (มือถือใช้ alert-polyfill.ts ซึ่งว่างเปล่า)
 *
 * react-native-web ทำ Alert.alert เป็นฟังก์ชันว่าง กล่องยืนยันทุกจุดจึงเงียบ
 * ผลคือกดบันทึกแล้วเหมือนไม่เกิดอะไร: ไม่มีกล่อง "บันทึกสำเร็จ" ไม่ย้อนกลับหน้ารายการ
 * error ไม่ขึ้น และถ้ามีรูปค้าง กล่องถาม "บันทึกต่อไหม" ไม่ขึ้นจึงไม่บันทึกเลย
 *
 * แทนที่ตรงนี้ที่เดียวด้วยกล่องของ browser ไม่ต้องไล่แก้ทุกจุดที่เรียก Alert.alert
 *
 * กล่องของ browser มีแค่ "ตกลง" กับ "ยกเลิก" จึงแปลงปุ่มตามนี้
 * - ปุ่มที่ไม่มี onPress คือปุ่มปิดกล่องเฉย ๆ ไม่นับเป็นทางเลือก
 * - ไม่มีทางเลือก: แสดงข้อความอย่างเดียว
 * - มีทางเลือกเดียวและไม่มีปุ่มปิด (เช่น "บันทึกสำเร็จ" → ตกลงแล้วย้อนกลับ): แสดงแล้วทำต่อเลย
 * - นอกนั้นถามทีละทางเลือกด้วย confirm โดยถามปุ่ม destructive (เช่น "บันทึกทับ") เป็นอันสุดท้าย
 *   กดตกลงพลาดครั้งแรกจะได้ไม่ทับข้อมูลของคนอื่น
 */
Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
  const text = [title, message].filter(Boolean).join('\n\n');
  const list = buttons ?? [];
  const actions = list
    .filter((b) => b.style !== 'cancel' && b.onPress)
    .sort((a, b) => Number(a.style === 'destructive') - Number(b.style === 'destructive'));
  const cancel = list.find((b) => b.style === 'cancel');

  if (actions.length === 0) {
    window.alert(text);
    cancel?.onPress?.();
    return;
  }
  if (actions.length === 1 && list.length === 1) {
    window.alert(text);
    actions[0].onPress?.();
    return;
  }
  for (const [i, button] of actions.entries()) {
    const prompt = actions.length === 1 ? text : `${i === 0 ? text + '\n\n' : ''}→ ${button.text}?`;
    if (window.confirm(prompt)) {
      button.onPress?.();
      return;
    }
  }
  cancel?.onPress?.();
};

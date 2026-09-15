import { memo, useCallback, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { elevation, font, radius, spacing, type ThemeColors } from "@/constants/theme";
import { useLanguage } from "@/context/language-context";
import { useColors } from "@/context/theme-context";
import { BREAK_TIME_VALUE, type IdleTimeRecord } from "@/types";

interface Props {
  record: IdleTimeRecord;
  /**
   * รับ record กลับไปแทนการปิดทับค่าไว้ในฟังก์ชัน
   * เพื่อให้หน้าเรียกส่ง callback ตัวเดิมได้ทุกรอบ memo จึงทำงานได้จริง
   */
  onPress: (record: IdleTimeRecord) => void;
}

function RecordCardBase({ record, onPress }: Props) {
  const c = useColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(c), [c]);
  const isFilled = !!record.idleTimeIssue;
  /**
   * ช่วงพักไม่ใช่ปัญหาการผลิต จึงไม่ควรใช้สีเขียวปนกับรายการที่แก้ปัญหาจริงไปแล้ว
   * ยึดข้อความในช่องสาเหตุเป็นตัวชี้ขาด เหมือนที่ฝั่งเว็บใช้จัดกลุ่มในรายงาน
   */
  const isBreak = record.idleTimeIssue === BREAK_TIME_VALUE;
  const handlePress = useCallback(() => onPress(record), [onPress, record]);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isBreak ? styles.cardBreak : isFilled ? styles.cardDone : styles.cardPending,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.headerRow}>
        <Text style={styles.workOrder} numberOfLines={1}>
          #{record.no} · {record.workOrder}
        </Text>
        <View
          style={[
            styles.badge,
            isBreak ? styles.badgeBreak : isFilled ? styles.badgeDone : styles.badgePending,
          ]}>
          <Text style={styles.badgeText}>
            {isBreak ? t("badgeBreak") : isFilled ? t("badgeDone") : t("badgePending")}
          </Text>
        </View>
      </View>

      <Text style={styles.model} numberOfLines={1}>
        {record.modelSuffix}
      </Text>

      {/* ช่วงเวลาที่หยุด บอกให้รู้ว่าเกิดตอนไหนของกะโดยไม่ต้องเปิดเข้าไปดู */}
      <Text style={styles.timeRange}>
        {record.startTime} - {record.endTime}
      </Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {t("lotSizeLabel")} {record.lotSize}
        </Text>
        <Text style={[styles.totalMins, isBreak && styles.totalMinsBreak]}>
          {record.totalMins.toFixed(2)} min
        </Text>
      </View>

      {isFilled && (
        <Text style={styles.issueText} numberOfLines={1}>
          {t("issuePrefix")}: {record.idleTimeIssue}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/**
 * กะหนึ่งมีได้หลักร้อยรายการ ถ้าไม่ memo ไว้ การพิมพ์ค้นหาหนึ่งตัวอักษร
 * จะสั่งให้การ์ดทุกใบเรนเดอร์ใหม่ทั้งหมด ซึ่งหน่วงชัดบนมือถือรุ่นกลางที่ใช้หน้างาน
 */
const RecordCard = memo(RecordCardBase);
export default RecordCard;

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.md,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      ...elevation.card,
    },
    /** ยังไม่กรอกสาเหตุ = แดง, กรอกแล้ว = เขียว ใช้โทนที่ปรับมาให้อ่านออกทั้งสองโหมด */
    cardPending: { backgroundColor: c.cardPendingBg, borderColor: c.danger },
    cardDone: { backgroundColor: c.badgeDoneBg, borderColor: c.success },
    /** ช่วงพัก = เหลือง บอกว่าหยุดจริงแต่เป็นตามแผน ไม่ใช่ปัญหาที่ต้องตามแก้ */
    cardBreak: { backgroundColor: c.breakBg, borderColor: c.breakAccent },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    workOrder: {
      fontSize: font.body,
      fontWeight: "700",
      color: c.textPrimary,
      flexShrink: 1,
    },
    badge: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      flexShrink: 0,
      marginLeft: spacing.sm,
    },
    /** พื้น badge ใช้สีสถานะทึบ เพราะพื้นแบบเดิมกลืนกับพื้นการ์ด (1.02:1) */
    badgeDone: { backgroundColor: c.statusDoneFill },
    badgePending: { backgroundColor: c.statusPendingFill },
    badgeBreak: { backgroundColor: c.statusBreakFill },
    badgeText: { fontSize: font.small, fontWeight: "600", color: c.onStatus },
    model: {
      fontSize: font.small,
      color: c.textSecondaryStrong,
      marginTop: spacing.xs,
    },
    timeRange: {
      fontSize: font.small,
      color: c.textSecondaryStrong,
      marginTop: spacing.xs,
      // ตัวเลขความกว้างเท่ากันทุกหลัก ทำให้เวลาในแต่ละใบเรียงตรงกันเวลากวาดสายตา
      fontVariant: ["tabular-nums"],
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      // ระยะเท่ากับบรรทัดอื่นในกลุ่มหัวการ์ด ค่า 12 เดิมเป็นของตอนที่ยังไม่มีบรรทัดเวลาคั่น
      marginTop: spacing.xs,
    },
    metaText: { fontSize: font.small, color: c.textSecondaryStrong },
    totalMins: { fontSize: font.body, fontWeight: "700", color: c.danger },
    /** เวลาที่หยุดในช่วงพักไม่ควรเป็นสีแดง เพราะไม่ได้เป็นเวลาที่เสียไปจริง */
    totalMinsBreak: { color: c.breakAccent },
    issueText: {
      fontSize: font.small,
      color: c.textPrimary,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
  });

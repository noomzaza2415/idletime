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
  /**
   * ลำดับในกลุ่ม work order ที่กางอยู่ (เริ่ม 1) — ส่งมาเมื่อการ์ดอยู่ในกลุ่มเท่านั้น
   * หัวกลุ่มบอก work order กับ model ไปแล้ว จึงตัดออกไม่ให้ซ้ำ และลดสีลงไม่ให้แย่งสายตาจากหัวกลุ่ม
   */
  positionInGroup?: number;
}

function RecordCardBase({ record, onPress, positionInGroup }: Props) {
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
  const statusColor = isBreak ? c.statusBreakFill : isFilled ? c.statusDoneFill : c.statusPendingFill;

  if (positionInGroup !== undefined) {
    return (
      <TouchableOpacity
        style={[styles.nestedCard, { borderLeftColor: statusColor }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.headerRow}>
          <Text style={styles.workOrder} numberOfLines={1}>
            #{positionInGroup}
            {"  ·  "}
            <Text style={styles.timeRange}>
              {record.startTime} - {record.endTime}
            </Text>
          </Text>
          {/* ป้ายแบบเส้นขอบ เบากว่าป้ายทึบของหัวกลุ่ม แต่ยังบอกสถานะด้วยสีและข้อความ */}
          <View style={[styles.badgeOutline, { borderColor: statusColor }]}>
            <Text style={[styles.badgeOutlineText, { color: statusColor }]}>
              {isBreak ? t("badgeBreak") : isFilled ? t("badgeDone") : t("badgePending")}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText} numberOfLines={1}>
            {t("lotSizeLabel")} {record.lotSize}
          </Text>
          <Text
            style={[
              styles.totalMins,
              isBreak ? styles.totalMinsBreak : isFilled && styles.totalMinsDone,
            ]}>
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
        {/*
          การ์ดเดี่ยวไม่แสดงเลขลำดับ เพราะ work order นี้มีรายการเดียว ไม่มีอะไรให้นับ
          และเลข no เป็นลำดับของทั้งกะ ถ้าแสดงคู่กับเลข 1..n ในกลุ่มจะมีเลขสองชุดปนกันบนจอ
          ใช้ขนาดเดียวกับหัวกลุ่ม ให้ทุกใบระดับบนสุดขึ้นต้นด้วยเลข work order ตัวใหญ่เหมือนกัน
        */}
        <Text style={[styles.workOrder, styles.workOrderTop]} numberOfLines={1}>
          {record.workOrder}
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

      {/*
        ช่วงเวลาที่หยุดกับ lot อยู่บรรทัดเดียวกัน ให้การ์ดเตี้ยลงหนึ่งบรรทัด
        จอหนึ่งเห็นรายการได้มากขึ้น ลีดเดอร์เลื่อนหาน้อยลง
      */}
      <View style={styles.metaRow}>
        <Text style={styles.metaText} numberOfLines={1}>
          <Text style={styles.timeRange}>
            {record.startTime} - {record.endTime}
          </Text>
          {"  ·  "}
          {t("lotSizeLabel")} {record.lotSize}
        </Text>
        <Text
          style={[
            styles.totalMins,
            isBreak ? styles.totalMinsBreak : isFilled && styles.totalMinsDone,
          ]}>
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
    /**
     * แถบสีหนาทางซ้ายบอกสถานะ ใช้หลักเดียวกับจอควบคุมในโรงงาน (ISA-101)
     * คือสีเต็มใบสงวนไว้ให้รายการที่ยังต้องลงมือทำ ใบที่จบแล้วเหลือแค่แถบสี
     * เดิมทุกใบมีพื้นสีเต็ม ใบเขียวที่เสร็จแล้วจึงแย่งสายตาจากใบแดงที่ยังค้าง
     */
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
      borderLeftWidth: 6,
      ...elevation.card,
    },
    cardPending: {
      backgroundColor: c.cardPendingBg,
      borderColor: c.danger,
      borderLeftColor: c.statusPendingFill,
    },
    cardDone: { borderLeftColor: c.statusDoneFill },
    /** การ์ดในกลุ่ม: พื้นปกติทุกสถานะ เหลือแค่แถบซ้ายบอกสี ให้หัวกลุ่มเป็นจุดเด่นเพียงจุดเดียว */
    nestedCard: {
      backgroundColor: c.surface,
      borderRadius: radius.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
      borderLeftWidth: 4,
    },
    /** ช่วงพัก = เหลือง บอกว่าหยุดจริงแต่เป็นตามแผน ไม่ใช่ปัญหาที่ต้องตามแก้ */
    cardBreak: { borderLeftColor: c.statusBreakFill },
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
    workOrderTop: { fontSize: font.h2 },
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
    badgeText: { fontSize: font.small, fontWeight: "700", color: c.onStatus },
    badgeOutline: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      flexShrink: 0,
      marginLeft: spacing.sm,
    },
    badgeOutlineText: { fontSize: font.small, fontWeight: "700" },
    model: {
      fontSize: font.small,
      color: c.textSecondaryStrong,
      marginTop: spacing.xs,
    },
    timeRange: {
      color: c.textPrimary,
      fontWeight: "600",
      // ตัวเลขความกว้างเท่ากันทุกหลัก ทำให้เวลาในแต่ละใบเรียงตรงกันเวลากวาดสายตา
      fontVariant: ["tabular-nums"],
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    metaText: { flexShrink: 1, fontSize: font.small, color: c.textSecondaryStrong },
    totalMins: {
      fontSize: font.body,
      fontWeight: "800",
      color: c.danger,
      fontVariant: ["tabular-nums"],
    },
    /** กรอกสาเหตุแล้วไม่ต้องเร่งด้วยสีแดงอีก แต่ยังตัวหนาให้อ่านยอดนาทีได้ทันที */
    totalMinsDone: { color: c.textPrimary },
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

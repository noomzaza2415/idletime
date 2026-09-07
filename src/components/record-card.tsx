import { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { elevation, font, radius, spacing, type ThemeColors } from "@/constants/theme";
import { useLanguage } from "@/context/language-context";
import { useColors } from "@/context/theme-context";
import type { IdleTimeRecord } from "@/types";

interface Props {
  record: IdleTimeRecord;
  onPress: () => void;
}

export default function RecordCard({ record, onPress }: Props) {
  const c = useColors();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(c), [c]);
  const isFilled = !!record.idleTimeIssue;

  return (
    <TouchableOpacity
      style={[styles.card, isFilled ? styles.cardDone : styles.cardPending]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.headerRow}>
        <Text style={styles.workOrder} numberOfLines={1}>
          #{record.no} · {record.workOrder}
        </Text>
        <View style={[styles.badge, isFilled ? styles.badgeDone : styles.badgePending]}>
          <Text style={styles.badgeText}>
            {isFilled ? t("badgeDone") : t("badgePending")}
          </Text>
        </View>
      </View>

      <Text style={styles.model} numberOfLines={1}>
        {record.modelSuffix}
      </Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{record.lotSize}</Text>
        <Text style={styles.totalMins}>{record.totalMins.toFixed(2)} min</Text>
      </View>

      {isFilled && (
        <Text style={styles.issueText} numberOfLines={1}>
          {t("issuePrefix")}: {record.idleTimeIssue}
        </Text>
      )}
    </TouchableOpacity>
  );
}

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
    badgeText: { fontSize: font.small, fontWeight: "600", color: c.onStatus },
    model: {
      fontSize: font.small,
      color: c.textSecondaryStrong,
      marginTop: spacing.xs,
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.md,
    },
    metaText: { fontSize: font.small, color: c.textSecondaryStrong },
    totalMins: { fontSize: font.body, fontWeight: "700", color: c.danger },
    issueText: {
      fontSize: font.small,
      color: c.textPrimary,
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
  });

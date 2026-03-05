/**
 * AI Savings Nudge Screen — donut chart, harvest vs savings,
 * Hindi nudge text, "Save Now" CTA.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useNudges, useHealthCheck } from "../hooks/useData";

/* ── Donut chart (pure RN) ── */
function DonutChart({ percent, size = 140 }: { percent: number; size?: number }) {
  const thickness = 14;
  const r = (size - thickness) / 2;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Track */}
      <View style={[donutS.ring, { width: size, height: size, borderRadius: size / 2, borderWidth: thickness, borderColor: colors.border }]} />
      {/* Filled segments (simulated with quarters) */}
      <View style={[donutS.ring, { width: size, height: size, borderRadius: size / 2, borderWidth: thickness,
        borderBottomColor: percent > 0 ? colors.primary : "transparent",
        borderLeftColor: percent > 25 ? colors.primary : "transparent",
        borderTopColor: percent > 50 ? colors.success : "transparent",
        borderRightColor: percent > 75 ? colors.success : "transparent",
        transform: [{ rotate: "-45deg" }],
      }]} />
      <View style={donutS.center}>
        <Text style={donutS.pct}>{percent}%</Text>
        <Text style={donutS.label}>Saved</Text>
      </View>
    </View>
  );
}
const donutS = StyleSheet.create({
  ring: { position: "absolute" },
  center: { alignItems: "center" },
  pct: { fontSize: 28, fontWeight: "900", color: colors.ink },
  label: { fontSize: 11, fontWeight: "700", color: colors.muted, marginTop: 2 },
});

export default function SavingsNudgeScreen() {
  const nav = useNavigation<any>();
  const health = useHealthCheck();
  const nudges = useNudges(5);
  const isOnline = health.data?.status === "ok";

  const expectedHarvest = 45000;
  const currentSavings = 12500;
  const pct = Math.round((currentSavings / expectedHarvest) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>AI Savings Nudge</Text>
        <View style={[styles.onlineDot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary stat tiles */}
        <View style={styles.statRow}>
          <View style={styles.statTile}>
            <Ionicons name="leaf" size={18} color={colors.success} />
            <Text style={styles.statLabel}>Expected Harvest</Text>
            <Text style={styles.statValue}>₹{expectedHarvest.toLocaleString()}</Text>
          </View>
          <View style={styles.statTile}>
            <Ionicons name="wallet" size={18} color={colors.primary} />
            <Text style={styles.statLabel}>Current Savings</Text>
            <Text style={styles.statValue}>₹{currentSavings.toLocaleString()}</Text>
          </View>
        </View>

        {/* Donut */}
        <View style={styles.donutCard}>
          <DonutChart percent={pct} />
          <View style={styles.donutLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
              <Text style={styles.legendText}>Savings</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>Target</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
              <Text style={styles.legendText}>Remaining</Text>
            </View>
          </View>
        </View>

        {/* Hindi nudge */}
        <View style={styles.nudgeCard}>
          <View style={styles.nudgeIcon}>
            <Ionicons name="bulb" size={20} color={colors.warn} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nudgeTitle}>Smart Savings Tip</Text>
            <Text style={styles.nudgeHindi}>समय पर बचत! फसल के बाद 10% बीज कोष में जोड़ें?</Text>
            <Text style={styles.nudgeEn}>Save on time! Add 10% to seed fund after harvest?</Text>
          </View>
        </View>

        {/* AI insights */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI Recommendations</Text>
          {[
            { icon: "trending-up", text: "Wheat prices expected to rise 8% next month", color: colors.success },
            { icon: "shield-checkmark", text: "PM-KISAN installment due in 15 days", color: colors.primary },
            { icon: "warning", text: "Set aside ₹3,000 for Rabi fertilizer", color: colors.warn },
          ].map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <View style={[styles.tipIcon, { backgroundColor: tip.color + "18" }]}>
                <Ionicons name={tip.icon as any} size={14} color={tip.color} />
              </View>
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          ))}
        </View>

        {/* Save Now CTA */}
        <Pressable style={styles.cta}>
          <Ionicons name="wallet" size={20} color="#FFF" />
          <Text style={styles.ctaText}>Save Now</Text>
        </Pressable>

        {/* Insurance link */}
        <Pressable style={styles.secondaryCta} onPress={() => nav.navigate("Eligibility")}>
          <Ionicons name="shield" size={16} color={colors.primary} />
          <Text style={styles.secondaryCtaText}>Check Insurance & Schemes</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "900", color: colors.ink },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  content: { padding: 16, paddingBottom: 100 },
  statRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statTile: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 14, alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border },
  statLabel: { fontSize: 10, fontWeight: "700", color: colors.muted },
  statValue: { fontSize: 18, fontWeight: "900", color: colors.ink },
  donutCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 14, borderWidth: 1, borderColor: colors.border, gap: 16, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  donutLegend: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontWeight: "700", color: colors.muted },
  nudgeCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#FFFBEB", borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#FDE68A" },
  nudgeIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.warnTint, alignItems: "center", justifyContent: "center" },
  nudgeTitle: { fontSize: 13, fontWeight: "900", color: colors.ink },
  nudgeHindi: { fontSize: 13, fontWeight: "700", color: "#92400E", marginTop: 4, lineHeight: 20 },
  nudgeEn: { fontSize: 11, fontWeight: "500", color: colors.muted, marginTop: 4, fontStyle: "italic" },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: "900", color: colors.ink },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tipIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tipText: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.ink, lineHeight: 17 },
  cta: { marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ctaText: { fontSize: 15, fontWeight: "900", color: "#FFF" },
  secondaryCta: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.primaryTint },
  secondaryCtaText: { fontSize: 13, fontWeight: "800", color: colors.primary },
});

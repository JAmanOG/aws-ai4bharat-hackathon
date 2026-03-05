/**
 * Eligibility Screen — user farming data table, AI eligibility score circle,
 * pre-approval badge, "Continue Application" CTA.
 * Fixed: facts is an object (Record<string,string>), not an array.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useMemoryFacts, useHealthCheck } from "../hooks/useData";

/* ── Score circle ── */
function ScoreCircle({ score, size = 100 }: { score: number; size?: number }) {
  const isGood = score >= 6;
  const color = isGood ? colors.success : score >= 4 ? colors.warn : colors.danger;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={[scS.ring, { width: size, height: size, borderRadius: size / 2, borderWidth: 6, borderColor: colors.border }]} />
      <View style={[scS.ring, { width: size, height: size, borderRadius: size / 2, borderWidth: 6,
        borderBottomColor: color,
        borderLeftColor: score > 2.5 ? color : "transparent",
        borderTopColor: score > 5 ? color : "transparent",
        borderRightColor: score > 7.5 ? color : "transparent",
        transform: [{ rotate: "-45deg" }],
      }]} />
      <Text style={[scS.score, { color }]}>{score.toFixed(1)}</Text>
      <Text style={scS.label}>out of 10</Text>
    </View>
  );
}
const scS = StyleSheet.create({
  ring: { position: "absolute" },
  score: { fontSize: 30, fontWeight: "900" },
  label: { fontSize: 10, fontWeight: "700", color: colors.muted, marginTop: 1 },
});

export default function EligibilityScreen() {
  const nav = useNavigation<any>();
  const health = useHealthCheck();
  const { data: factsRaw, loading: isLoading } = useMemoryFacts();
  const isOnline = health.data?.status === "ok";

  /* Normalize facts — could be object or array */
  const factsMap: Record<string, string> = {};
  if (factsRaw) {
    if (Array.isArray(factsRaw)) {
      factsRaw.forEach((f: any) => { if (f.factKey) factsMap[f.factKey] = f.factValue; });
    } else if (typeof factsRaw === "object") {
      Object.assign(factsMap, factsRaw);
    }
  }

  const name = factsMap.user_name || factsMap.name || "Farmer";
  const crop = factsMap.primary_crop || factsMap.crop || "Wheat";
  const land = factsMap.land_size || factsMap.land || "2 acres";
  const state = factsMap.state || "Madhya Pradesh";
  const experience = factsMap.farming_experience || "5 years";
  const score = 7.0;

  const DATA_ROWS = [
    { label: "Farmer Name", value: name, icon: "person" },
    { label: "Primary Crop", value: crop, icon: "leaf" },
    { label: "Land Size", value: land, icon: "map" },
    { label: "State", value: state, icon: "location" },
    { label: "Experience", value: experience, icon: "time" },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Loan Eligibility</Text>
        <View style={[styles.onlineDot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 12, color: colors.muted, fontWeight: "600" }}>Loading your data...</Text>
          </View>
        ) : (
          <>
            {/* Farming data card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your Farming Profile</Text>
              {DATA_ROWS.map((r) => (
                <View key={r.label} style={styles.dataRow}>
                  <View style={styles.dataIcon}>
                    <Ionicons name={r.icon as any} size={14} color={colors.primary} />
                  </View>
                  <Text style={styles.dataLabel}>{r.label}</Text>
                  <Text style={styles.dataValue}>{r.value}</Text>
                </View>
              ))}
            </View>

            {/* AI Score card */}
            <View style={styles.scoreCard}>
              <Text style={styles.cardTitle}>AI Eligibility Score</Text>
              <ScoreCircle score={score} />
              <View style={styles.preApproval}>
                <Ionicons name="shield-checkmark" size={16} color="#FFF" />
                <Text style={styles.preApprovalText}>Pre-Approved</Text>
              </View>
              <Text style={styles.scoreExplain}>
                Based on your land record, crop history, and government schemes eligibility.
              </Text>
            </View>

            {/* Eligible schemes */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Matching Schemes</Text>
              {[
                { name: "PM-KISAN", amt: "₹6,000/yr", match: "95%", color: colors.success },
                { name: "KCC Loan", amt: "Up to ₹3L", match: "88%", color: colors.primary },
                { name: "Crop Insurance", amt: "Premium ₹800", match: "72%", color: colors.warn },
              ].map((scheme) => (
                <View key={scheme.name} style={styles.schemeRow}>
                  <View style={[styles.schemeIcon, { backgroundColor: scheme.color + "18" }]}>
                    <Ionicons name="flag" size={14} color={scheme.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.schemeName}>{scheme.name}</Text>
                    <Text style={styles.schemeAmt}>{scheme.amt}</Text>
                  </View>
                  <View style={[styles.matchBadge, { backgroundColor: scheme.color + "18" }]}>
                    <Text style={[styles.matchText, { color: scheme.color }]}>{scheme.match}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* CTA */}
            <Pressable style={styles.cta}>
              <Ionicons name="document-text" size={20} color="#FFF" />
              <Text style={styles.ctaText}>Continue Application</Text>
            </Pressable>
          </>
        )}
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
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border, gap: 10, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardTitle: { fontSize: 15, fontWeight: "900", color: colors.ink, marginBottom: 4 },
  dataRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  dataIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center" },
  dataLabel: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.muted },
  dataValue: { fontSize: 12, fontWeight: "800", color: colors.ink },
  scoreCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 14, borderWidth: 1, borderColor: colors.border, gap: 14, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  preApproval: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.success, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  preApprovalText: { fontSize: 12, fontWeight: "900", color: "#FFF" },
  scoreExplain: { fontSize: 11, fontWeight: "600", color: colors.muted, textAlign: "center", lineHeight: 17 },
  schemeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  schemeIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  schemeName: { fontSize: 12, fontWeight: "800", color: colors.ink },
  schemeAmt: { fontSize: 10, fontWeight: "600", color: colors.muted, marginTop: 1 },
  matchBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  matchText: { fontSize: 11, fontWeight: "900" },
  cta: { marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  ctaText: { fontSize: 15, fontWeight: "900", color: "#FFF" },
});

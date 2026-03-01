/**
 * AI Savings Nudge Screen — donut chart, harvest vs savings, Hindi nudge.
 * Matches reference: Expected Harvest / Current Savings donut, Hindi CTA.
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
import { useNudges } from "../hooks/useData";

export default function SavingsNudgeScreen() {
  const nav = useNavigation<any>();
  const nudges = useNudges(5);
  const nudgeData = (nudges.data as any)?.nudges?.[0];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Status */}
      <View style={styles.statusBar}>
        <Ionicons name="cloud-offline-outline" size={14} color={colors.muted} />
        <Text style={styles.statusLabel}>Offline</Text>
      </View>

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Rural Ecosystem Platform</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>AI Savings Nudge</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Expected</Text>
            <Text style={styles.statSub}>Harvest</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Current</Text>
            <Text style={styles.statSub}>Savings</Text>
          </View>
        </View>

        {/* Donut placeholder */}
        <View style={styles.donutWrap}>
          <View style={styles.donutOuter}>
            <View style={styles.donutInner}>
              <Ionicons name="analytics-outline" size={28} color={colors.primary} />
              <Text style={styles.donutText}>Nudge</Text>
            </View>
          </View>
        </View>

        {/* Hindi CTA message */}
        <View style={styles.messageCard}>
          <Text style={styles.hindiTitle}>समय पर बचत!</Text>
          <Text style={styles.hindiBody}>
            फसल के बाद 10% बीज कोष{"\n"}में जोड़ें?
          </Text>
        </View>

        {/* Save Now button */}
        <Pressable style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>Save Now</Text>
        </Pressable>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  statusBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 6, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statusLabel: { fontSize: 11, fontWeight: "600", color: colors.muted },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 13, fontWeight: "900", color: colors.ink, letterSpacing: 0.6 },

  content: { paddingHorizontal: 20, paddingTop: 12, alignItems: "center" },

  title: { fontSize: 20, fontWeight: "900", color: colors.ink, textAlign: "center" },

  statsRow: { flexDirection: "row", gap: 16, marginTop: 20 },
  statCard: { alignItems: "center" },
  statLabel: { fontSize: 13, fontWeight: "800", color: colors.ink },
  statSub: { fontSize: 11, fontWeight: "600", color: colors.muted },

  /* Donut */
  donutWrap: { marginTop: 24, alignItems: "center" },
  donutOuter: {
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 12, borderColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(74,144,217,0.06)",
  },
  donutInner: { alignItems: "center", gap: 4 },
  donutText: { fontSize: 14, fontWeight: "900", color: colors.ink },

  /* Message */
  messageCard: { marginTop: 24, alignItems: "center" },
  hindiTitle: { fontSize: 20, fontWeight: "900", color: colors.ink },
  hindiBody: { marginTop: 6, fontSize: 14, fontWeight: "600", color: colors.muted, textAlign: "center", lineHeight: 22 },

  saveBtn: {
    marginTop: 24, width: "100%", paddingVertical: 16, borderRadius: 14,
    backgroundColor: colors.primary, alignItems: "center",
  },
  saveBtnText: { fontSize: 14, fontWeight: "900", color: "#FFF", letterSpacing: 0.5 },
});

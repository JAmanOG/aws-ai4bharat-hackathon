/**
 * Loan Eligibility Assessment Screen — user farming data, AI score, pre-approval.
 * Matches reference: Property 18, User Farming Data, AI Eligibility Score 7.0.
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

export default function EligibilityScreen() {
  const nav = useNavigation<any>();

  return (
    <SafeAreaView style={styles.safe}>
      {/* Status */}
      <View style={styles.statusBar}>
        <Ionicons name="wifi" size={14} color={colors.primary} />
        <Text style={styles.statusLabel}>Property</Text>
      </View>

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Rural Ecosystem Platform</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Property 18</Text>
        <Text style={styles.subtitle}>(Loan Eligibility Assessment)</Text>

        {/* User Farming Data */}
        <View style={styles.dataCard}>
          <Text style={styles.cardTitle}>User Farming Data</Text>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>User name</Text>
            <Text style={styles.dataValue}>User farmo</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Capacity</Text>
            <Text style={styles.dataValue}>Peri filling more</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Weight</Text>
            <Text style={styles.dataValue}>5,900</Text>
          </View>
          <View style={styles.divLine} />
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Pre-Farming</Text>
            <Text style={styles.dataValue}>Jun 13, 2020</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Bsmtest</Text>
            <Text style={styles.dataValue}>3.5 years</Text>
          </View>
        </View>

        {/* AI Score */}
        <View style={styles.scoreSection}>
          <View style={{ flex: 1 }}>
            <Text style={styles.scoreLabel}>AI Eligibility Score</Text>
            <Text style={styles.scoreSub}>Automated AI Eligibility</Text>
          </View>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreValue}>7.0</Text>
          </View>
        </View>

        {/* Pre-Approval */}
        <View style={styles.approvalRow}>
          <Text style={styles.approvalLabel}>Pre-Approval</Text>
          <View style={styles.approvalBadge}>
            <Text style={styles.approvalText}>Pre-Approval</Text>
          </View>
        </View>

        {/* CTA */}
        <Pressable style={styles.cta}>
          <Text style={styles.ctaText}>Continue Application</Text>
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

  content: { paddingHorizontal: 20, paddingTop: 12 },

  title: { fontSize: 20, fontWeight: "900", color: colors.ink, textAlign: "center" },
  subtitle: { fontSize: 12, fontWeight: "600", color: colors.muted, textAlign: "center", marginTop: 2 },

  /* Data card */
  dataCard: {
    marginTop: 20, backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: "900", color: colors.ink, marginBottom: 12 },
  dataRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  dataLabel: { fontSize: 12, fontWeight: "700", color: colors.muted },
  dataValue: { fontSize: 12, fontWeight: "800", color: colors.ink },
  divLine: { height: 1, backgroundColor: colors.border, marginVertical: 8 },

  /* Score */
  scoreSection: {
    marginTop: 16, flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1,
    borderColor: colors.border, padding: 16,
  },
  scoreLabel: { fontSize: 13, fontWeight: "800", color: colors.ink },
  scoreSub: { fontSize: 11, fontWeight: "600", color: colors.muted, marginTop: 2 },
  scoreBadge: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primaryTint, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.primary,
  },
  scoreValue: { fontSize: 20, fontWeight: "900", color: colors.primary },

  /* Approval */
  approvalRow: {
    marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  approvalLabel: { fontSize: 13, fontWeight: "800", color: colors.ink },
  approvalBadge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: colors.primaryTint,
  },
  approvalText: { fontSize: 11, fontWeight: "800", color: colors.primary },

  /* CTA */
  cta: {
    marginTop: 24, width: "100%", paddingVertical: 16, borderRadius: 14,
    backgroundColor: colors.primary, alignItems: "center",
  },
  ctaText: { fontSize: 14, fontWeight: "900", color: "#FFF", letterSpacing: 0.5 },
});

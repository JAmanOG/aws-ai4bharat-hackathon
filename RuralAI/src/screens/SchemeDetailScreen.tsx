import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";

type SchemeDetail = {
  id: string;
  title: string;
  benefit: string;
  eligibility: string;
  docs: string[];
  steps: string[];
};

const DETAILS: Record<string, SchemeDetail> = {
  pmkisan: {
    id: "pmkisan",
    title: "PM-Kisan Samman Nidhi",
    benefit: "₹6,000/year (3 installments)",
    eligibility: "Small & marginal farmers (as per scheme rules)",
    docs: ["Aadhaar card", "Land records", "Bank account details", "Mobile number"],
    steps: [
      "Keep Aadhaar + land records ready.",
      "Apply via official portal or Common Service Center (CSC).",
      "Submit details and verify.",
      "Track status regularly.",
    ],
  },
  kcc: {
    id: "kcc",
    title: "Kisan Credit Card (KCC)",
    benefit: "Low-interest credit for farming needs",
    eligibility: "Farmers with valid land records / eligibility as per bank",
    docs: ["Aadhaar card", "Land records", "Passport photo", "Bank KYC"],
    steps: [
      "Visit your bank branch / apply via supported channel.",
      "Submit KYC and land documents.",
      "Bank verifies details and approves limit.",
      "Use card for inputs/expenses and repay on time.",
    ],
  },
  pmsby: {
    id: "pmsby",
    title: "PMSBY Accident Insurance",
    benefit: "₹2 lakh accidental death/disability cover",
    eligibility: "Eligible bank account holders",
    docs: ["Aadhaar", "Bank account", "Nominee details"],
    steps: ["Opt-in through bank/app/branch.", "Pay yearly premium.", "Keep nominee details updated."],
  },
  pmjay: {
    id: "pmjay",
    title: "PM-JAY (Ayushman Bharat)",
    benefit: "Up to ₹5 lakh health cover",
    eligibility: "Eligible families (as per criteria)",
    docs: ["Aadhaar / ID proof", "Family ID (if applicable)", "Hospital documents"],
    steps: ["Check eligibility.", "Get e-card if eligible.", "Use at empanelled hospitals."],
  },
  "subsidy-irrig": {
    id: "subsidy-irrig",
    title: "Irrigation Subsidy",
    benefit: "Partial subsidy for irrigation support",
    eligibility: "Depends on state policy",
    docs: ["Aadhaar", "Land records", "Bank details"],
    steps: ["Check your state portal.", "Apply with required documents.", "Track application status."],
  },
};

export default function SchemeDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const schemeId = (route?.params?.schemeId ?? "pmkisan") as string;

  const detail = useMemo(() => DETAILS[schemeId] ?? DETAILS.pmkisan, [schemeId]);
  const [saved, setSaved] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>

          <Text style={styles.title} numberOfLines={1}>Scheme Detail</Text>

          <Pressable style={styles.saveBtn} onPress={() => setSaved((v) => !v)}>
            <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={18} color={colors.earth} />
            <Text style={styles.saveText}>{saved ? "Saved" : "Save"}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Main card */}
          <View style={styles.card}>
            <Text style={styles.schemeTitle}>{detail.title}</Text>
            <Text style={styles.benefit}>{detail.benefit}</Text>
            <Text style={styles.eligibility}>{detail.eligibility}</Text>

            {saved ? (
              <View style={styles.savedPill}>
                <Ionicons name="cloud-done-outline" size={14} color={colors.primary} />
                <Text style={styles.savedText}>Available offline</Text>
              </View>
            ) : null}
          </View>

          {/* Docs checklist */}
          <Text style={styles.section}>What you need</Text>
          <View style={styles.card}>
            {detail.docs.map((d, idx) => (
              <View key={idx} style={styles.checkRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.checkText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Steps */}
          <Text style={styles.section}>Steps</Text>
          <View style={styles.card}>
            {detail.steps.map((s, idx) => (
              <View key={idx} style={styles.stepRow}>
                <View style={styles.num}>
                  <Text style={styles.numText}>{idx + 1}</Text>
                </View>
                <Text style={styles.stepText}>{s}</Text>
              </View>
            ))}
          </View>

          {/* CTA */}
          <Pressable style={styles.primaryBtn}>
            <Ionicons name="open-outline" size={18} color={colors.ink} />
            <Text style={styles.primaryText}>Open Apply Portal</Text>
          </Pressable>

          <Pressable style={styles.secondaryBtn}>
            <Ionicons name="call-outline" size={18} color={colors.earth} />
            <Text style={styles.secondaryText}>Call Helpline</Text>
          </Pressable>

          <View style={{ height: 24 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 16, fontWeight: "900", color: colors.ink },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(139,94,60,0.10)",
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.22)",
  },
  saveText: { fontSize: 11, fontWeight: "900", color: colors.earth },

  content: { paddingTop: 12, paddingBottom: 18, gap: 12 },

  section: { marginTop: 6, fontSize: 18, fontWeight: "900", color: colors.ink },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  schemeTitle: { fontSize: 14, fontWeight: "900", color: colors.ink },
  benefit: { fontSize: 12, fontWeight: "900", color: colors.earth },
  eligibility: { fontSize: 11, fontWeight: "700", color: colors.muted, lineHeight: 16 },

  savedPill: {
    marginTop: 6,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(19,236,91,0.12)",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.22)",
  },
  savedText: { fontSize: 10, fontWeight: "900", color: colors.ink },

  checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkText: { flex: 1, fontSize: 12, fontWeight: "800", color: colors.ink },

  stepRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  num: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(19,236,91,0.14)",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  numText: { fontSize: 11, fontWeight: "900", color: colors.ink },
  stepText: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.muted, lineHeight: 16 },

  primaryBtn: {
    marginTop: 6,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.35)",
  },
  primaryText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.ink },

  secondaryBtn: {
    backgroundColor: "rgba(139,94,60,0.10)",
    borderRadius: 18,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.22)",
  },
  secondaryText: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: colors.earth },
});
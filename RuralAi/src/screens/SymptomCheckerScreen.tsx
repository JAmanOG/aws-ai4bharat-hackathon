import React, { useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Linking, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { chatWithText } from "../services/voice";
import { logger } from "../utils/logger";

type Sym = { key: string; label: string; icon: any };

const SYMPTOMS: Sym[] = [
  { key: "fever", label: "Fever", icon: "thermometer-outline" },
  { key: "cough", label: "Cough", icon: "cloud-outline" },
  { key: "headache", label: "Headache", icon: "flash-outline" },
  { key: "stomach", label: "Stomach pain", icon: "nutrition-outline" },
  { key: "breath", label: "Breathing issue", icon: "pulse-outline" },
  { key: "rash", label: "Skin rash", icon: "bandage-outline" },
];

type Risk = "LOW" | "MEDIUM" | "HIGH";

export default function SymptomCheckerScreen() {
  const nav = useNavigation<any>();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);

  const picked = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const risk: Risk = useMemo(() => {
    if (picked.includes("breath")) return "HIGH";
    if (picked.includes("fever") && picked.includes("cough")) return "MEDIUM";
    if (picked.length >= 3) return "MEDIUM";
    return picked.length ? "LOW" : "LOW";
  }, [picked]);

  const riskMeta = useMemo(() => {
    if (risk === "HIGH") return { bg: "rgba(185,28,28,0.10)", border: "rgba(185,28,28,0.18)", text: "#B91C1C" };
    if (risk === "MEDIUM") return { bg: "rgba(139,94,60,0.10)", border: "rgba(139,94,60,0.22)", text: colors.earth };
    return { bg: "rgba(19,236,91,0.12)", border: "rgba(19,236,91,0.22)", text: colors.ink };
  }, [risk]);

  const toggle = (key: string) => setSelected((p) => ({ ...p, [key]: !p[key] }));

  const handleGetAdvice = useCallback(async () => {
    if (picked.length === 0) return;
    setProcessing(true);
    try {
      const prompt = `I'm experiencing these symptoms: ${picked.join(", ")}. Risk level appears: ${risk}. What should I do? Give brief actionable health guidance for someone in a rural area with limited medical access. Keep it under 100 words.`;
      const res = await chatWithText(prompt, { language: "en" });
      setAiAdvice(res.response_text);
    } catch {
      setAiAdvice("Unable to get AI advice. Based on your symptoms, please consult a local health worker.");
    } finally {
      setProcessing(false);
    }
  }, [picked, risk]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Symptom Checker</Text>
            <Text style={styles.sub}>Voice-first • Quick guidance</Text>
          </View>
          <View style={styles.syncPill}>
            <View style={styles.syncDot} />
            <Text style={styles.syncText}>SYNCED</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Ionicons name="information-circle-outline" size={18} color={colors.earth} />
            <Text style={styles.disclaimerText}>
              This is not a medical diagnosis. If it feels urgent or severe, seek medical help immediately.
            </Text>
          </View>

          {/* Voice hint */}
          <View style={styles.voiceCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="mic" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>Describe by voice</Text>
            </View>
            <Text style={styles.helper}>Use the floating mic button to describe your symptoms by speaking naturally.</Text>
          </View>

          {/* Symptom chips */}
          <Text style={styles.sectionTitle}>Select symptoms</Text>
          <View style={styles.chipsWrap}>
            {SYMPTOMS.map((s) => {
              const active = !!selected[s.key];
              return (
                <Pressable
                  key={s.key}
                  onPress={() => toggle(s.key)}
                  style={[
                    styles.chip,
                    active ? styles.chipActive : styles.chipInactive,
                  ]}
                >
                  <Ionicons name={s.icon} size={14} color={active ? colors.ink : colors.earth} />
                  <Text style={[styles.chipText, { color: active ? colors.ink : colors.earth }]}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Risk card */}
          <View style={[styles.riskCard, { backgroundColor: riskMeta.bg, borderColor: riskMeta.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.riskTitle}>Risk level</Text>
              <View style={[styles.riskPill, { borderColor: riskMeta.border, backgroundColor: "#FFFFFFAA" }]}>
                <Text style={[styles.riskPillText, { color: riskMeta.text }]}>{risk}</Text>
              </View>
            </View>

            <Text style={styles.riskText}>
              {risk === "HIGH"
                ? "Breathing issues can be serious. Consider calling emergency/helpline or visiting a clinic."
                : risk === "MEDIUM"
                ? "Monitor symptoms. If they worsen or persist, consult a doctor."
                : picked.length
                ? "Basic home care may help. If symptoms persist, consult a doctor."
                : "Select symptoms to get guidance."}
            </Text>
          </View>

          {/* AI Advice */}
          {(aiAdvice || processing) && (
            <View style={{ backgroundColor: "rgba(74,144,217,0.08)", borderRadius: 18, borderWidth: 1, borderColor: "rgba(74,144,217,0.18)", padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: "900", color: colors.ink }}>AI Health Guidance</Text>
              </View>
              {processing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.ink, lineHeight: 18 }}>{aiAdvice}</Text>
              )}
            </View>
          )}

          {picked.length > 0 && !aiAdvice && !processing && (
            <Pressable style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center" }} onPress={handleGetAdvice}>
              <Text style={{ fontSize: 13, fontWeight: "900", color: "#FFF" }}>Get AI Advice</Text>
            </Pressable>
          )}

          {/* Next steps */}
          <Text style={styles.sectionTitle}>Next steps</Text>
          <View style={{ gap: 10 }}>
            <StepRow icon="water-outline" title="Hydration + rest" sub="Drink water, take rest" />
            <StepRow icon="thermometer-outline" title="Monitor temperature" sub="Check every few hours" />
            <StepRow icon="warning-outline" title="Emergency signs" sub="Severe breathing, chest pain, fainting" danger />
          </View>

          {/* CTAs */}
          <View style={styles.ctaRow}>
            <Pressable style={styles.primaryBtn} onPress={() => {
              logger.info("SymptomChecker", "Call helpline tapped");
              Linking.openURL("tel:104").catch(() => Alert.alert("Helpline", "Health helpline: 104"));
            }}>
              <Ionicons name="call-outline" size={18} color={colors.ink} />
              <Text style={styles.primaryText}>Call helpline</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => {
              logger.info("SymptomChecker", "Find clinic tapped");
              Linking.openURL("https://www.google.com/maps/search/clinic+near+me").catch(() => Alert.alert("Find Clinic", "Search for clinics near you on Google Maps."));
            }}>
              <Ionicons name="navigate-outline" size={18} color={colors.earth} />
              <Text style={styles.secondaryText}>Find clinic</Text>
            </Pressable>
          </View>

          <View style={{ height: 18 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function StepRow({ icon, title, sub, danger }: { icon: any; title: string; sub: string; danger?: boolean }) {
  return (
    <View style={[styles.stepRow, danger && { borderColor: "rgba(185,28,28,0.18)", backgroundColor: "rgba(185,28,28,0.06)" }]}>
      <View style={[styles.stepIcon, danger && { backgroundColor: "rgba(185,28,28,0.10)", borderColor: "rgba(185,28,28,0.18)" }]}>
        <Ionicons name={icon} size={18} color={danger ? "#B91C1C" : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.stepTitle, danger && { color: "#B91C1C" }]}>{title}</Text>
        <Text style={styles.stepSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "900", color: colors.ink },
  sub: { marginTop: 2, fontSize: 11, fontWeight: "700", color: colors.muted },

  syncPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(19,236,91,0.14)",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.35)",
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  syncText: { fontSize: 11, fontWeight: "900", color: colors.ink, letterSpacing: 0.6 },

  content: { paddingTop: 12, paddingBottom: 18, gap: 12 },

  disclaimer: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(139,94,60,0.10)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.18)",
    padding: 12,
  },
  disclaimerText: { flex: 1, fontSize: 11, fontWeight: "700", color: colors.ink, lineHeight: 16 },

  voiceCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: colors.ink },
  helper: { fontSize: 11, fontWeight: "700", color: colors.muted, lineHeight: 16 },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  chipActive: { backgroundColor: "rgba(19,236,91,0.18)", borderColor: "rgba(19,236,91,0.28)" },
  chipInactive: { backgroundColor: "rgba(139,94,60,0.10)", borderColor: "rgba(139,94,60,0.20)" },
  chipText: { fontSize: 11, fontWeight: "900" },

  riskCard: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 10 },
  riskTitle: { fontSize: 13, fontWeight: "900", color: colors.ink },
  riskPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  riskPillText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
  riskText: { fontSize: 11, fontWeight: "700", color: colors.muted, lineHeight: 16 },

  stepRow: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(19,236,91,0.12)",
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepTitle: { fontSize: 12, fontWeight: "900", color: colors.ink },
  stepSub: { marginTop: 3, fontSize: 11, fontWeight: "700", color: colors.muted, lineHeight: 16 },

  ctaRow: { marginTop: 6, flexDirection: "row", gap: 10 },
  primaryBtn: {
    flex: 1,
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
    width: 140,
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
  secondaryText: { fontSize: 11, fontWeight: "900", color: colors.earth },
});
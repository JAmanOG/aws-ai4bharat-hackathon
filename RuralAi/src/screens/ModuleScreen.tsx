import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { logger } from "../utils/logger";

type Action = { title: string; hint: string; icon: any; wide?: boolean };
type ModuleConfig = { subtitle: string; topCardTitle: string; topCardLines: string[]; actions: Action[] };

const MODULES: Record<string, ModuleConfig> = {
  AGRICULTURE: {
    subtitle: "Krishi • Prices • Crop help",
    topCardTitle: "Today’s Quick Info",
    topCardLines: ["Weather: Clear • 27°C", "Market: Wheat ↑", "Tip: Ask by voice for crop advice"],
    actions: [
      { title: "Market Prices", hint: "Live mandi rates", icon: "stats-chart-outline" },
      { title: "Crop Health Scan", hint: "Upload photo", icon: "camera-outline" },
      { title: "Expert Consultation", hint: "Voice Q&A", icon: "chatbubble-ellipses-outline" },
      { title: "Government Schemes", hint: "Eligibility & steps", icon: "document-text-outline", wide: true },
    ],
  },
  EDUCATION: {
    subtitle: "Shiksha • Skills • Learning",
    topCardTitle: "Learn Faster",
    topCardLines: ["Skill lessons in your language", "Download offline content", "Use voice to navigate"],
    actions: [
      { title: "Skill Development", hint: "Vocational + videos", icon: "briefcase-outline" },
      { title: "K-12 Support", hint: "Content + help", icon: "school-outline" },
      { title: "Digital Literacy", hint: "Basics + safety", icon: "shield-checkmark-outline" },
      { title: "Exam Prep", hint: "Tests + practice", icon: "clipboard-outline", wide: true },
    ],
  },
  FINANCE: {
    subtitle: "Artha • Loans • Benefits",
    topCardTitle: "Finance Snapshot",
    topCardLines: ["Check schemes & benefits", "Track applications", "Ask: “loan eligibility”"],
    actions: [
      { title: "Micro-credit & Loans", hint: "Apply + status", icon: "cash-outline" },
      { title: "Insurance", hint: "Crop/Health/Life", icon: "heart-outline" },
      { title: "Financial Literacy", hint: "Guidance + tips", icon: "book-outline" },
      { title: "Govt Benefits", hint: "Direct transfer", icon: "card-outline", wide: true },
    ],
  },
  HEALTH: {
    subtitle: "Swasthya • Care • Records",
    topCardTitle: "Health Quick Help",
    topCardLines: ["Symptom check (voice)", "Nearby clinics (later)", "Emergency guidance"],
    actions: [
      { title: "Symptom Checker", hint: "Voice-first", icon: "pulse-outline" },
      { title: "Telemedicine", hint: "Consult", icon: "videocam-outline" },
      { title: "Health Records", hint: "Secure access", icon: "folder-open-outline" },
      { title: "Wellness & Nutrition", hint: "Tips + alerts", icon: "nutrition-outline", wide: true },
    ],
  },
  INFRASTRUCTURE: {
    subtitle: "Suvidha • Civic • Utilities",
    topCardTitle: "Civic Actions",
    topCardLines: ["Report issues", "Use official portals", "Emergency services quick access"],
    actions: [
      { title: "Report Issue", hint: "Road/Water/Power", icon: "warning-outline" },
      { title: "Utility Services", hint: "Bills + complaints", icon: "build-outline" },
      { title: "Local Governance", hint: "Announcements", icon: "business-outline" },
      { title: "Emergency Services", hint: "One tap help", icon: "call-outline", wide: true },
    ],
  },
};

export default function ModuleScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const titleRaw = (route?.params?.title ?? "AGRICULTURE").toString().toUpperCase();
  const config = useMemo(() => MODULES[titleRaw] ?? MODULES.AGRICULTURE, [titleRaw]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>{titleRaw}</Text>
          <Text style={styles.hSub}>{config.subtitle}</Text>
        </View>

        <View style={styles.syncPill}>
          <View style={styles.syncDot} />
          <Text style={styles.syncText}>SYNCED</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top card */}
        <View style={styles.topCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={styles.topIcon}>
              <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.topTitle}>{config.topCardTitle}</Text>
          </View>

          <View style={{ marginTop: 10, gap: 6 }}>
            {config.topCardLines.map((line, idx) => (
              <View key={idx} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                <View style={styles.bullet} />
                <Text style={styles.topLine}>{line}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Actions grid */}
        <View style={styles.grid}>
          {config.actions.map((a) => (
            <Pressable
              key={a.title}
              style={[styles.tile, a.wide ? styles.tileWide : styles.tileHalf]}
              onPress={() => {
                logger.info("ModuleScreen", `Action tapped: ${a.title}`, { module: titleRaw });
                if (a.title === "Market Prices") {
                  nav.navigate("MarketPrices", { moduleTitle: titleRaw });
                  return;
                }
                if (a.title === "Government Schemes" || a.title === "Govt Benefits") {
                  nav.navigate("SchemesList", { moduleTitle: titleRaw });
                  return;
                }
                if (a.title === "Symptom Checker") {
                  nav.navigate("SymptomChecker");
                  return;
                }
                if (a.title === "Micro-credit & Loans" || a.title === "Insurance") {
                  nav.navigate("Eligibility");
                  return;
                }
                if (a.title === "Financial Literacy") {
                  nav.navigate("SavingsNudge");
                  return;
                }
                if (a.title === "Skill Development" || a.title === "K-12 Support" || a.title === "Digital Literacy") {
                  nav.navigate("KnowledgeDashboard");
                  return;
                }
                if (a.title === "Emergency Services") {
                  nav.navigate("Alerts");
                  return;
                }
                nav.navigate("Action", { moduleTitle: titleRaw, actionTitle: a.title });
              }}
            >
              <View style={styles.tileIcon}>
                <Ionicons name={a.icon} size={18} color={colors.earth} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tileTitle}>{a.title}</Text>
                <Text style={styles.tileHint}>{a.hint}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        {/* Voice CTA */}
        <Pressable style={styles.voiceCta} onPress={() => nav.navigate("Ask")}>
          <Ionicons name="mic" size={18} color={colors.ink} />
          <Text style={styles.voiceText}>VOICE SEARCH</Text>
        </Pressable>

        <View style={{ height: 18 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 14, paddingTop: 6, flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  hTitle: { fontSize: 16, fontWeight: "900", color: colors.ink, letterSpacing: 0.6 },
  hSub: { marginTop: 2, fontSize: 12, fontWeight: "700", color: colors.muted },

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

  content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 22 },

  topCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  topIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(19,236,91,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  topTitle: { fontSize: 13, fontWeight: "900", color: colors.ink },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 6 },
  topLine: { flex: 1, fontSize: 12, fontWeight: "700", color: colors.muted, lineHeight: 16 },

  grid: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tileHalf: { width: "48%" },
  tileWide: { width: "100%" },
  tileIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(139,94,60,0.10)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(139,94,60,0.18)",
  },
  tileTitle: { fontSize: 12, fontWeight: "900", color: colors.ink },
  tileHint: { marginTop: 3, fontSize: 11, fontWeight: "700", color: colors.muted },

  voiceCta: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  voiceText: { fontSize: 12, fontWeight: "900", letterSpacing: 1.2, color: colors.ink },
});
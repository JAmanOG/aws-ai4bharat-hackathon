import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useVoice } from "../voice/VoiceContext";
import { VisualizationCardRenderer } from "../voice/VoiceVisualizationCards";

type ModuleConfig = {
  subtitle: string;
  topCardTitle: string;
  topCardLines: string[];
  voicePrompts: string[];
};

const MODULES: Record<string, ModuleConfig> = {
  AGRICULTURE: {
    subtitle: "Krishi \u2022 Prices \u2022 Crop help",
    topCardTitle: "Today's Quick Info",
    topCardLines: ["Weather: Clear \u2022 27\u00B0C", "Market: Wheat \u2191", "Tip: Ask by voice for crop advice"],
    voicePrompts: [
      "\"\u0906\u091C \u0917\u0947\u0939\u0942\u0902 \u0915\u093E \u092D\u093E\u0935 \u0915\u094D\u092F\u093E \u0939\u0948?\" \u2014 Market Prices",
      "\"\u092B\u0938\u0932 \u092E\u0947\u0902 \u0915\u0940\u091F \u0932\u0917\u093E \u0939\u0948\" \u2014 Pest Advisory",
      "\"PM-Kisan \u0915\u0940 \u091C\u093E\u0928\u0915\u093E\u0930\u0940 \u0926\u094B\" \u2014 Government Schemes",
      "\"\u092E\u094C\u0938\u092E \u0915\u0948\u0938\u093E \u0930\u0939\u0947\u0917\u093E?\" \u2014 Weather Forecast",
    ],
  },
  EDUCATION: {
    subtitle: "Shiksha \u2022 Skills \u2022 Learning",
    topCardTitle: "Learn Faster",
    topCardLines: ["Skill lessons in your language", "Download offline content", "Use voice to navigate"],
    voicePrompts: [
      "\"\u0915\u094B\u0908 skill course \u092C\u0924\u093E\u0913\" \u2014 Courses",
      "\"Digital literacy \u0938\u093F\u0916\u093E\u0913\" \u2014 Digital Skills",
      "\"Exam prep help\" \u2014 Study Support",
    ],
  },
  FINANCE: {
    subtitle: "Artha \u2022 Loans \u2022 Benefits",
    topCardTitle: "Finance Snapshot",
    topCardLines: ["Check schemes & benefits", "Track applications", "Ask about loan eligibility"],
    voicePrompts: [
      "\"\u092E\u0947\u0930\u0947 \u0932\u093F\u090F \u0915\u094C\u0928 \u0938\u0940 \u092F\u094B\u091C\u0928\u093E \u0939\u0948?\" \u2014 Scheme Eligibility",
      "\"\u092B\u0938\u0932 \u092C\u0940\u092E\u093E \u0915\u093E status\" \u2014 Insurance",
      "\"\u092C\u091A\u0924 \u0915\u0948\u0938\u0947 \u0915\u0930\u0947\u0902?\" \u2014 Savings Plan",
      "\"Loan \u0915\u0947 \u0932\u093F\u090F \u0915\u094D\u092F\u093E \u091A\u093E\u0939\u093F\u090F?\" \u2014 Micro-credit",
    ],
  },
  HEALTH: {
    subtitle: "Swasthya \u2022 Care \u2022 Records",
    topCardTitle: "Health Quick Help",
    topCardLines: ["Symptom check (voice)", "Nearby clinics", "Emergency guidance"],
    voicePrompts: [
      "\"\u092C\u0941\u0916\u093E\u0930 \u0914\u0930 \u0916\u093E\u0902\u0938\u0940 \u0939\u0948\" \u2014 Symptom Check",
      "\"Nearest clinic \u092C\u0924\u093E\u0913\" \u2014 Health Services",
      "\"\u091F\u0940\u0915\u093E\u0915\u0930\u0923 schedule\" \u2014 Vaccination",
    ],
  },
  INFRASTRUCTURE: {
    subtitle: "Suvidha \u2022 Civic \u2022 Utilities",
    topCardTitle: "Civic Actions",
    topCardLines: ["Report issues", "Use official portals", "Emergency services quick access"],
    voicePrompts: [
      "\"\u0938\u095C\u0915 \u0916\u0930\u093E\u092C \u0939\u0948\" \u2014 Report Issue",
      "\"\u092C\u093F\u091C\u0932\u0940 \u0915\u091F\u0940 \u0939\u0948\" \u2014 Utility Services",
      "\"Emergency number \u091A\u093E\u0939\u093F\u090F\" \u2014 Emergency",
    ],
  },
};

export default function ModuleScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const titleRaw = (route?.params?.title ?? "AGRICULTURE").toString().toUpperCase();
  const config = useMemo(() => MODULES[titleRaw] ?? MODULES.AGRICULTURE, [titleRaw]);
  const { currentVisualization, history } = useVoice();

  /* Filter history for this domain */
  const domainHistory = useMemo(() => {
    return history.filter((h) => h.domain?.toUpperCase() === titleRaw).slice(0, 5);
  }, [history, titleRaw]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))}>
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

        {/* Voice prompts for this domain */}
        <View style={styles.promptSection}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="mic" size={16} color={colors.primary} />
            <Text style={styles.promptTitle}>Try saying</Text>
          </View>
          {config.voicePrompts.map((prompt, idx) => (
            <View key={idx} style={styles.promptRow}>
              <Text style={styles.promptText}>{prompt}</Text>
            </View>
          ))}
        </View>

        {/* Current visualization if available */}
        {currentVisualization && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.sectionLabel}>LATEST RESULT</Text>
            <VisualizationCardRenderer card={currentVisualization} />
          </View>
        )}

        {/* Domain voice history */}
        {domainHistory.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.sectionLabel}>RECENT IN {titleRaw}</Text>
            {domainHistory.map((entry, idx) => (
              <View key={idx} style={styles.historyRow}>
                <View style={styles.historyDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTranscript} numberOfLines={1}>{entry.text}</Text>
                  {entry.domain && <Text style={styles.historyResponse} numberOfLines={1}>{entry.domain} • {entry.intent ?? ""}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

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

  promptSection: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  promptTitle: { fontSize: 13, fontWeight: "900", color: colors.ink },
  promptRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "rgba(19,236,91,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.12)",
  },
  promptText: { fontSize: 12, fontWeight: "700", color: colors.muted, lineHeight: 17 },

  sectionLabel: { fontSize: 10, fontWeight: "900", color: colors.muted, letterSpacing: 1, marginBottom: 8 },

  historyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 4 },
  historyTranscript: { fontSize: 12, fontWeight: "900", color: colors.ink },
  historyResponse: { marginTop: 2, fontSize: 11, fontWeight: "700", color: colors.muted, lineHeight: 15 },
});

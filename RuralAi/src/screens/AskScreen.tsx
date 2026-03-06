/**
 * Ask Screen — Voice results canvas.
 *
 * This screen is intentionally minimal: it acts as a real-time visual
 * representation of the user's spoken requests. All recording flows are
 * handled by the global VoiceOverlay — this canvas only consumes
 * VoiceContext state and renders results.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useVoice } from "../voice/VoiceContext";
import { VisualizationCardRenderer } from "../voice/VoiceVisualizationCards";

/* ── Domain badge colors ── */
const DOMAIN_COLORS: Record<string, string> = {
  agriculture: "#2E7D32",
  market: "#1565C0",
  schemes: "#6A1B9A",
  finance: "#EF6C00",
  health: "#C62828",
  knowledge: colors.primary,
  logistics: "#5D4037",
  general: colors.muted,
};

/* ── Voice state indicator ── */
function StateIndicator({ state }: { state: string }) {
  const meta = STATE_META[state] ?? STATE_META.idle;
  return (
    <View style={[si.wrap, { backgroundColor: meta.bg }]}>
      <View style={[si.dot, { backgroundColor: meta.color }]} />
      <Text style={[si.label, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const STATE_META: Record<string, { label: string; color: string; bg: string }> = {
  idle: { label: "Ready", color: colors.muted, bg: colors.bg },
  listening: { label: "Listening…", color: colors.danger, bg: "rgba(239,68,68,0.08)" },
  processing: { label: "Thinking…", color: colors.warn, bg: "rgba(245,158,11,0.08)" },
  speaking: { label: "Speaking…", color: colors.primary, bg: "rgba(74,144,217,0.08)" },
  visualizing: { label: "Done", color: colors.success, bg: "rgba(19,236,91,0.08)" },
};

const si = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: "center" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
});

/* ── Main Component ── */
export default function AskScreen() {
  const {
    state,
    transcript,
    responseText,
    currentVisualization,
    lastCommand,
    history,
  } = useVoice();

  const domain = lastCommand?.domain ?? "general";
  const domainColor = DOMAIN_COLORS[domain] ?? colors.muted;

  /* Recent history for inline display */
  const recentHistory = history.slice(-6).reverse();

  const hasResults = !!(transcript || responseText || currentVisualization);
  const showEmpty = !hasResults && state === "idle" && recentHistory.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        {/* Title */}
        <Text style={styles.platformTitle}>RURAL AI</Text>
        <Text style={styles.hindiSub}>आपका डिजिटल साथी</Text>

        {/* Voice state */}
        <View style={styles.stateRow}>
          <StateIndicator state={state} />
        </View>

        {/* Domain badge when active */}
        {lastCommand && domain !== "general" && (
          <View style={[styles.domainBadge, { backgroundColor: domainColor + "14" }]}>
            <View style={[styles.domainDot, { backgroundColor: domainColor }]} />
            <Text style={[styles.domainText, { color: domainColor }]}>{domain.toUpperCase()}</Text>
          </View>
        )}

        {/* Transcript */}
        {transcript ? (
          <View style={styles.transcriptCard}>
            <View style={styles.transcriptHeader}>
              <Ionicons name="mic" size={14} color={colors.primary} />
              <Text style={styles.transcriptLabel}>You said</Text>
            </View>
            <Text style={styles.transcriptText}>{transcript}</Text>
          </View>
        ) : null}

        {/* Visualization card */}
        {currentVisualization && (
          <View style={styles.vizSection}>
            <VisualizationCardRenderer card={currentVisualization} />
          </View>
        )}

        {/* AI Response (when no viz card) */}
        {responseText && !currentVisualization ? (
          <View style={styles.responseCard}>
            <View style={styles.responseHeader}>
              <Ionicons name="sparkles" size={14} color={colors.success} />
              <Text style={styles.responseLabel}>AI Response</Text>
            </View>
            <Text style={styles.responseText}>{responseText}</Text>
          </View>
        ) : null}

        {/* Chat history */}
        {recentHistory.length > 0 && (
          <View style={styles.chatSection}>
            <Text style={styles.sectionTitle}>Recent</Text>
            {recentHistory.map((entry) => (
              <View key={entry.id} style={[styles.bubble, entry.role === "user" ? styles.bubbleUser : styles.bubbleAi]}>
                <View style={styles.bubbleHeader}>
                  <Ionicons
                    name={entry.role === "user" ? "person-circle" : "sparkles"}
                    size={12}
                    color={entry.role === "user" ? colors.primary : colors.success}
                  />
                  <Text style={[styles.bubbleRole, { color: entry.role === "user" ? colors.primary : colors.success }]}>
                    {entry.role === "user" ? "You" : "AI"}
                  </Text>
                  {entry.domain && entry.role !== "user" && (
                    <View style={[styles.miniBadge, { backgroundColor: (DOMAIN_COLORS[entry.domain] ?? colors.muted) + "18" }]}>
                      <Text style={[styles.miniBadgeText, { color: DOMAIN_COLORS[entry.domain] ?? colors.muted }]}>
                        {entry.domain}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.bubbleText} numberOfLines={3}>{entry.text}</Text>
                {/* Inline viz card for assistant entries */}
                {entry.visualization && entry.role !== "user" && (
                  <View style={styles.inlineViz}>
                    <VisualizationCardRenderer card={entry.visualization} />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Empty state */}
        {showEmpty && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="mic-outline" size={48} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Speak to get started</Text>
            <Text style={styles.emptyHint}>
              Tap the mic button to ask anything.{"\n"}
              The screen will update with your results.
            </Text>

            {/* Suggestion chips */}
            <View style={styles.suggestionsWrap}>
              <Text style={styles.suggestLabel}>TRY SAYING</Text>
              {SUGGESTIONS.map((s) => (
                <View key={s} style={styles.suggestChip}>
                  <Ionicons name="chatbubble-outline" size={12} color={colors.primary} />
                  <Text style={styles.suggestText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Vision block */}
        <View style={styles.visionBlock}>
          <Ionicons name="sparkles" size={16} color={colors.primary} />
          <Text style={styles.visionText}>
            Voice is the primary control. Speak naturally and the screen responds.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Suggestion prompts ── */
const SUGGESTIONS = [
  "\"Wheat ka bhav batao\"",
  "\"Mausam kaisa hai?\"",
  "\"PM Kisan scheme details\"",
  "\"Insurance claim status\"",
];

/* ── Styles ── */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { alignItems: "center", paddingHorizontal: 20, paddingBottom: 120, paddingTop: 14 },

  platformTitle: { fontSize: 18, fontWeight: "900", color: colors.ink, letterSpacing: 3, textAlign: "center" },
  hindiSub: { marginTop: 4, fontSize: 13, fontWeight: "600", color: colors.muted, textAlign: "center" },

  stateRow: { marginTop: 16 },

  domainBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 10,
    alignSelf: "center",
  },
  domainDot: { width: 6, height: 6, borderRadius: 3 },
  domainText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },

  transcriptCard: {
    width: "100%",
    marginTop: 16,
    backgroundColor: "rgba(74,144,217,0.08)",
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  transcriptHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  transcriptLabel: { fontSize: 10, fontWeight: "900", color: colors.primary, letterSpacing: 0.4 },
  transcriptText: { fontSize: 14, fontWeight: "700", color: colors.ink, lineHeight: 20 },

  vizSection: { width: "100%", marginTop: 14 },

  responseCard: {
    width: "100%",
    marginTop: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  responseHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  responseLabel: { fontSize: 10, fontWeight: "900", color: colors.success, letterSpacing: 0.4 },
  responseText: { fontSize: 13, fontWeight: "600", color: colors.ink, lineHeight: 20 },

  chatSection: { width: "100%", marginTop: 18, gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: "900", color: colors.muted, letterSpacing: 0.5, marginBottom: 4 },

  bubble: { borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border, gap: 4 },
  bubbleUser: { backgroundColor: "rgba(74,144,217,0.05)", borderBottomLeftRadius: 4 },
  bubbleAi: { backgroundColor: colors.surface, borderBottomRightRadius: 4 },
  bubbleHeader: { flexDirection: "row", alignItems: "center", gap: 4 },
  bubbleRole: { fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
  bubbleText: { fontSize: 13, fontWeight: "600", lineHeight: 18, color: colors.ink },
  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginLeft: 4 },
  miniBadgeText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.3 },
  inlineViz: { marginTop: 6 },

  emptyState: { alignItems: "center", marginTop: 30, gap: 10 },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: colors.ink },
  emptyHint: { fontSize: 13, fontWeight: "600", color: colors.muted, textAlign: "center", lineHeight: 20 },

  suggestionsWrap: { marginTop: 20, width: "100%", gap: 8 },
  suggestLabel: { fontSize: 10, fontWeight: "900", color: colors.muted, letterSpacing: 0.8, marginBottom: 4 },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestText: { fontSize: 13, fontWeight: "700", color: colors.ink, fontStyle: "italic" },

  visionBlock: {
    width: "100%",
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.primaryTint,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  visionText: { flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 18, color: colors.ink },
});

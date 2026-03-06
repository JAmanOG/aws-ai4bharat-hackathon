/**
 * Home Screen — Voice-first dashboard.
 *
 * Shows online/offline status, recent voice interactions, and
 * contextual suggestions. Deliberately minimal — the user should
 * interact via the voice overlay, not through manual navigation cards.
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
import { useHealthCheck } from "../hooks/useData";
import { useAuth } from "../contexts/AuthContext";
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

export default function HomeScreen() {
  const health = useHealthCheck();
  const { user } = useAuth();
  const { history, currentVisualization, lastCommand, state } = useVoice();
  const isOnline = health.data?.status === "ok";
  const firstName = user?.name ? user.name.split(" ")[0] : "";

  /* Recent voice history (last 4) */
  const recentHistory = history.slice(-4).reverse();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={[styles.dot, { backgroundColor: isOnline ? colors.success : colors.danger }]} />
        <Text style={styles.statusText}>{isOnline ? "Online" : "Offline — cached data"}</Text>
        <View style={styles.voiceBadge}>
          <Ionicons name="mic" size={12} color={colors.primary} />
          <Text style={styles.voiceBadgeText}>VOICE FIRST</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome */}
        <Text style={styles.greeting}>Namaste{firstName ? `, ${firstName}` : ""} 🙏</Text>
        <Text style={styles.greetingSub}>Speak to explore. The screen will respond.</Text>

        {/* Current visualization (if any) */}
        {currentVisualization && (
          <View style={styles.vizSection}>
            <View style={styles.vizHeader}>
              <Ionicons name="sparkles" size={14} color={colors.success} />
              <Text style={styles.vizLabel}>Latest Result</Text>
              {lastCommand?.domain && (
                <View style={[styles.domainPill, { backgroundColor: (DOMAIN_COLORS[lastCommand.domain] ?? colors.muted) + "18" }]}>
                  <Text style={[styles.domainPillText, { color: DOMAIN_COLORS[lastCommand.domain] ?? colors.muted }]}>
                    {lastCommand.domain.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <VisualizationCardRenderer card={currentVisualization} />
          </View>
        )}

        {/* Voice suggestions */}
        <View style={styles.promptSection}>
          <Text style={styles.sectionTitle}>What can you ask?</Text>
          {VOICE_PROMPTS.map((p) => (
            <View key={p.label} style={styles.promptCard}>
              <View style={[styles.promptIcon, { backgroundColor: p.color + "14" }]}>
                <Ionicons name={p.icon as any} size={18} color={p.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.promptLabel}>{p.label}</Text>
                <Text style={styles.promptExample}>{p.example}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Recent voice interactions */}
        {recentHistory.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Recent conversations</Text>
            {recentHistory.map((entry) => (
              <View
                key={entry.id}
                style={[styles.historyCard, entry.role === "user" ? styles.historyUser : styles.historyAi]}
              >
                <View style={styles.historyHeader}>
                  <Ionicons
                    name={entry.role === "user" ? "person-circle" : "sparkles"}
                    size={12}
                    color={entry.role === "user" ? colors.primary : colors.success}
                  />
                  <Text style={[styles.historyRole, { color: entry.role === "user" ? colors.primary : colors.success }]}>
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
                <Text style={styles.historyText} numberOfLines={2}>{entry.text}</Text>
                {entry.visualization && entry.role !== "user" && (
                  <View style={{ marginTop: 6 }}>
                    <VisualizationCardRenderer card={entry.visualization} />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Empty state when no history */}
        {recentHistory.length === 0 && !currentVisualization && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.border} />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyHint}>
              Tap the mic button to start speaking.{"\n"}
              Ask about market prices, schemes, weather, or anything else.
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Voice prompt suggestions ── */
const VOICE_PROMPTS = [
  { label: "Market Prices", example: "\"Gehu ka bhav kya hai?\"", icon: "trending-up", color: "#1565C0" },
  { label: "Government Schemes", example: "\"PM Kisan ke baare mein batao\"", icon: "document-text", color: "#6A1B9A" },
  { label: "Weather", example: "\"Aaj mausam kaisa rahega?\"", icon: "cloud", color: "#00838F" },
  { label: "Crop Advisory", example: "\"Meri fasal ke liye salaah\"", icon: "leaf", color: "#2E7D32" },
  { label: "Savings & Insurance", example: "\"Bachat yojana dikhao\"", icon: "wallet", color: "#EF6C00" },
];

/* ── Styles ── */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 11, fontWeight: "700", color: colors.muted },
  voiceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.primaryTint,
  },
  voiceBadgeText: { fontSize: 9, fontWeight: "900", color: colors.primary, letterSpacing: 0.5 },

  content: { padding: 20, paddingBottom: 120 },
  greeting: { fontSize: 22, fontWeight: "900", color: colors.ink },
  greetingSub: { marginTop: 4, fontSize: 13, fontWeight: "500", color: colors.muted },

  vizSection: { marginTop: 20, gap: 8 },
  vizHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  vizLabel: { fontSize: 11, fontWeight: "900", color: colors.success, letterSpacing: 0.4 },
  domainPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  domainPillText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },

  promptSection: { marginTop: 24, gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: colors.ink, marginBottom: 4 },
  promptCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  promptIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  promptLabel: { fontSize: 13, fontWeight: "800", color: colors.ink },
  promptExample: { fontSize: 11, fontWeight: "600", color: colors.muted, marginTop: 2, fontStyle: "italic" },

  historySection: { marginTop: 24, gap: 8 },
  historyCard: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  historyUser: { backgroundColor: "rgba(74,144,217,0.05)", borderBottomLeftRadius: 4 },
  historyAi: { backgroundColor: colors.surface, borderBottomRightRadius: 4 },
  historyHeader: { flexDirection: "row", alignItems: "center", gap: 4 },
  historyRole: { fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
  historyText: { fontSize: 13, fontWeight: "600", color: colors.ink, lineHeight: 18 },
  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginLeft: 4 },
  miniBadgeText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.3 },

  emptyState: { alignItems: "center", marginTop: 30, gap: 8, paddingVertical: 20 },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
  emptyHint: { fontSize: 12, fontWeight: "600", color: colors.muted, textAlign: "center", lineHeight: 18 },
});

/**
 * VoiceDrivenScreen — Full-screen dynamic visualization.
 *
 * This screen is navigated to when the voice engine determines a rich
 * visualization is needed. It renders the current VoiceContext
 * visualization plus conversation history in a full-screen card layout.
 *
 * The screen dynamically responds to voice commands flowing through
 * VoiceContext — as the user keeps talking, cards update in real-time.
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useVoice, type HistoryEntry } from "../voice/VoiceContext";
import { VisualizationCardRenderer } from "../voice/VoiceVisualizationCards";

/* Domain colors for header tint */
const DOMAIN_COLORS: Record<string, string> = {
  agriculture: "#2E7D32",
  market: "#1565C0",
  schemes: "#6A1B9A",
  finance: "#EF6C00",
  health: "#C62828",
  knowledge: colors.primary,
  logistics: "#5D4037",
  general: colors.primary,
};

export default function VoiceDrivenScreen() {
  const {
    currentVisualization,
    lastCommand,
    transcript,
    history,
    state,
  } = useVoice();

  const domain = lastCommand?.domain ?? "general";
  const domainColor = DOMAIN_COLORS[domain] ?? colors.primary;

  /* Recent history (last 6 items) */
  const recentHistory = history.slice(-6).reverse();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: domainColor + "30" }]}>
        <View style={styles.headerTitleWrap}>
          <View style={[styles.domainDot, { backgroundColor: domainColor }]} />
          <Text style={styles.headerTitle}>
            {currentVisualization?.title ?? "Voice Results"}
          </Text>
        </View>
        <View
          style={[styles.statePill, { backgroundColor: stateColor(state) + "20" }]}
        >
          <View
            style={[styles.stateDot, { backgroundColor: stateColor(state) }]}
          />
          <Text style={[styles.stateText, { color: stateColor(state) }]}>
            {stateLabel(state)}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Live transcript */}
        {transcript ? (
          <View style={styles.transcriptCard}>
            <View style={styles.transcriptHeader}>
              <Ionicons name="mic" size={14} color={colors.primary} />
              <Text style={styles.transcriptLabel}>Your query</Text>
            </View>
            <Text style={styles.transcriptText}>{transcript}</Text>
          </View>
        ) : null}

        {/* Current visualization */}
        {currentVisualization ? (
          <VisualizationCardRenderer
            card={currentVisualization}
          />
        ) : (
          <View style={styles.emptyViz}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={48}
              color={colors.border}
            />
            <Text style={styles.emptyText}>
              Speak to see results here
            </Text>
            <Text style={styles.emptyHint}>
              The voice overlay mic is always available
            </Text>
          </View>
        )}

        {/* Conversation history */}
        {recentHistory.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Conversation</Text>
            {recentHistory.map((entry) => (
              <HistoryBubble key={entry.id} entry={entry} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── History Bubble ── */

function HistoryBubble({
  entry,
}: {
  entry: HistoryEntry;
}) {
  const isUser = entry.role === "user";
  return (
    <View style={styles.historyBubbleWrap}>
      <View style={[styles.historyBubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <View style={styles.bubbleHeader}>
          <Ionicons
            name={isUser ? "person-circle" : "sparkles"}
            size={14}
            color={isUser ? colors.primary : colors.success}
          />
          <Text
            style={[
              styles.bubbleRole,
              { color: isUser ? colors.primary : colors.success },
            ]}
          >
            {isUser ? "You" : "AI"}
          </Text>
          {entry.domain && !isUser && (
            <View
              style={[
                styles.miniDomainBadge,
                {
                  backgroundColor:
                    (DOMAIN_COLORS[entry.domain] ?? colors.muted) + "18",
                },
              ]}
            >
              <Text
                style={[
                  styles.miniDomainText,
                  {
                    color: DOMAIN_COLORS[entry.domain] ?? colors.muted,
                  },
                ]}
              >
                {entry.domain}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.bubbleText} numberOfLines={4}>
          {entry.text}
        </Text>
        {/* Inline viz card for assistant entries */}
        {entry.visualization && !isUser && (
          <View style={styles.inlineViz}>
            <VisualizationCardRenderer
              card={entry.visualization}
            />
          </View>
        )}
      </View>
    </View>
  );
}

/* ── Helpers ── */

function stateColor(s: string): string {
  switch (s) {
    case "listening":
      return colors.danger;
    case "processing":
      return colors.warn;
    case "speaking":
      return colors.primary;
    case "visualizing":
      return colors.success;
    default:
      return colors.muted;
  }
}

function stateLabel(s: string): string {
  switch (s) {
    case "listening":
      return "Listening";
    case "processing":
      return "Thinking";
    case "speaking":
      return "Speaking";
    case "visualizing":
      return "Done";
    default:
      return "Ready";
  }
}

/* ── Styles ── */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  domainDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.ink,
    flex: 1,
  },
  statePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stateText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  /* Scroll */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 100,
  },

  /* Transcript */
  transcriptCard: {
    backgroundColor: "rgba(74,144,217,0.08)",
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  transcriptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  transcriptLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.primary,
    letterSpacing: 0.4,
  },
  transcriptText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 20,
  },

  /* Empty */
  emptyViz: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
  },
  emptyHint: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
  },

  /* History */
  historySection: {
    marginTop: 8,
    gap: 10,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.muted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  historyBubbleWrap: {
    marginBottom: 2,
  },
  historyBubble: {
    borderRadius: 16,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userBubble: {
    backgroundColor: "rgba(74,144,217,0.05)",
    borderBottomLeftRadius: 4,
  },
  aiBubble: {
    backgroundColor: colors.surface,
    borderBottomRightRadius: 4,
  },
  bubbleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  bubbleRole: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  miniDomainBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  miniDomainText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  bubbleText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    lineHeight: 18,
  },
  inlineViz: {
    marginTop: 6,
  },
});

import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { chatWithText } from "../services/voice";
import { logger } from "../utils/logger";

type ChatMsg = { role: "user" | "assistant"; text: string };

export default function ActionScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const moduleTitle = route?.params?.moduleTitle ?? "Module";
  const actionTitle = route?.params?.actionTitle ?? "Action";

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [asked, setAsked] = useState(false);

  const fetchInfo = useCallback(async () => {
    if (loading) return;
    logger.info("ActionScreen", `Fetching AI info for ${actionTitle} in ${moduleTitle}`);
    setLoading(true);
    setAsked(true);
    const prompt = `Give me a brief overview and key actions available for the "${actionTitle}" section under "${moduleTitle}" module in Rugro. Answer in 3-5 bullet points.`;
    setMessages((prev) => [...prev, { role: "user", text: prompt }]);
    try {
      const res = await chatWithText(prompt, { language: "en" });
      setMessages((prev) => [...prev, { role: "assistant", text: res.response_text }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "Could not load information. Please check your connection and try again." }]);
    } finally {
      setLoading(false);
    }
  }, [actionTitle, moduleTitle, loading]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>{actionTitle}</Text>
          <Text style={styles.hSub}>{moduleTitle}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {!asked ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Ask AI about {actionTitle}</Text>
            <Text style={styles.emptySub}>
              Tap below to get AI-powered information and actions for this module.
            </Text>
            <Pressable style={styles.askBtn} onPress={fetchInfo}>
              <Ionicons name="sparkles" size={18} color="#FFF" />
              <Text style={styles.askBtnText}>Get Information</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {messages.filter((m) => m.role === "assistant").map((m, i) => (
              <View key={i} style={styles.msgCard}>
                <Ionicons name="sparkles" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                <Text style={styles.msgText}>{m.text}</Text>
              </View>
            ))}
            {loading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadText}>Loading…</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Voice CTA */}
      <View style={styles.bottomBar}>
        <Pressable style={styles.voiceBtn} onPress={() => nav.navigate("Ask")}>
          <Ionicons name="mic" size={20} color="#FFF" />
          <Text style={styles.voiceBtnText}>Ask by Voice</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 14, paddingTop: 6, flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  hTitle: { fontSize: 16, fontWeight: "900", color: colors.ink },
  hSub: { marginTop: 2, fontSize: 12, fontWeight: "700", color: colors.muted },
  body: { flexGrow: 1, padding: 20 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(74,144,217,0.08)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: colors.ink, textAlign: "center" },
  emptySub: { marginTop: 8, fontSize: 13, fontWeight: "600", color: colors.muted, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  askBtn: { marginTop: 20, flexDirection: "row", gap: 8, alignItems: "center", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary },
  askBtnText: { fontSize: 14, fontWeight: "900", color: "#FFF" },
  msgCard: { flexDirection: "row", gap: 10, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14 },
  msgText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.ink, lineHeight: 20 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 12 },
  loadText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  bottomBar: { padding: 14, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  voiceBtn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 14, backgroundColor: colors.primary },
  voiceBtnText: { fontSize: 14, fontWeight: "900", color: "#FFF" },
});

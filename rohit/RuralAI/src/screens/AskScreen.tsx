import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { Modal } from "../components/ui/Modal";
import { useAlert } from "../components/ui/AlertProvider";
import { Button } from "../components/ui/Button";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { healthApi } from "../api/health";

type Msg = { id: string; from: "user" | "ai"; text: string; status?: "queued" | "thinking"; riskLevel?: string };

export default function AskScreen() {
  const { showAlert } = useAlert();
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [textInput, setTextInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const handleSend = async (text: string) => {
    console.log(`[ACTION] Submitting query to Health AI: "${text}"`);
    if (!text.trim() || text.trim().length < 5) {
      console.log("[ACTION] Query rejected: too short");
      if (!text.trim() || text.trim().length < 5) {
        console.log("[ACTION] Query rejected: too short");
        showAlert({ title: "Info", message: "Please describe your question in at least 5 characters." });
        return;
      }
      return;
    }
    const userMsg: Msg = { id: `u-${Date.now()}`, from: "user", text: text.trim() };
    const thinkingMsg: Msg = { id: `t-${Date.now()}`, from: "ai", text: "Analyzing your symptoms...", status: "thinking" };
    setMessages(prev => [...prev, userMsg, thinkingMsg]);
    setTextInput("");
    setShowKeyboard(false);
    setLoading(true);

    console.log("[CRUD:CREATE] Sending symptom check request to health api");
    try {
      const res = await healthApi.checkSymptoms({
        symptoms: text.trim(),
        age: 30,
      });

      // Remove thinking message, add AI response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== thinkingMsg.id);
        if (res.data) {
          const d = res.data;
          const parts: string[] = [];
          parts.push(`🔍 Risk Level: ${d.risk_level}`);
          if (d.urgency) parts.push(`⏰ Urgency: ${d.urgency}`);
          parts.push("");
          if (d.possible_conditions?.length) {
            parts.push("📋 Possible Conditions:");
            d.possible_conditions.forEach((c: string) => parts.push(`  • ${c}`));
            parts.push("");
          }
          if (d.recommended_action) {
            parts.push(`💊 ${d.recommended_action}`);
            parts.push("");
          }
          if (d.home_remedies?.length) {
            parts.push("🏠 Home Remedies:");
            d.home_remedies.forEach((r: string) => parts.push(`  • ${r}`));
            parts.push("");
          }
          if (d.warning_signs?.length) {
            parts.push("⚠️ Warning Signs:");
            d.warning_signs.forEach((w: string) => parts.push(`  • ${w}`));
          }

          const aiMsg: Msg = {
            id: `ai-${Date.now()}`,
            from: "ai",
            text: parts.join("\n"),
            riskLevel: d.risk_level,
          };
          console.log("[CRUD:CREATE] Successfully received AI response:", aiMsg.text.substring(0, 50) + "...");
          return [...filtered, aiMsg];
        } else {
          console.log("[CRUD:CREATE] AI returned no data or error:", res.error);
          return [...filtered, { id: `ai-${Date.now()}`, from: "ai", text: `Sorry, I couldn't process that: ${res.error || "Unknown error"}` }];
        }
      });
    } catch (err: any) {
      console.log("[CRUD:CREATE] Network/Unexpected error during symptom check:", err);
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== thinkingMsg.id);
        return [...filtered, { id: `ai-${Date.now()}`, from: "ai", text: `Network error: ${err.message}. Please try again.` }];
      });
    }
    setLoading(false);
  };

  const riskColor = (level?: string) => {
    if (level === "Critical") return "#B91C1C";
    if (level === "High") return "#D97706";
    if (level === "Low") return colors.primary;
    return colors.earth;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="menu" size={20} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>Ask</Text>
          <View style={styles.syncPill}>
            <View style={styles.syncDot} />
            <Text style={styles.syncText}>AI READY</Text>
          </View>
        </View>

        {/* Chat */}
        <ScrollView contentContainerStyle={styles.chat} showsVerticalScrollIndicator={false}>
          {messages.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="pulse-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Health AI Assistant</Text>
              <Text style={styles.emptySub}>Describe your symptoms and I'll provide a preliminary assessment. Tap the mic or keyboard to start.</Text>
              <View style={styles.exampleRow}>
                {["Headache and fever", "Chest pain", "Stomach pain since 2 days"].map(ex => (
                  <Pressable key={ex} style={styles.exampleChip} onPress={() => handleSend(ex)}>
                    <Text style={styles.exampleText}>{ex}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {messages.map((m) => (
            <View key={m.id} style={[styles.bubbleWrap, m.from === "user" ? { alignItems: "flex-end" } : { alignItems: "flex-start" }]}>
              <View style={[styles.bubble, m.from === "user" ? styles.userBubble : styles.aiBubble,
              m.riskLevel ? { borderLeftWidth: 3, borderLeftColor: riskColor(m.riskLevel) } : {}]}>
                <Text style={[styles.bubbleText, { color: colors.ink }]}>{m.text}</Text>
                {m.status === "thinking" && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.meta}>Analyzing...</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Bottom voice area */}
        <View style={styles.bottom}>
          <Pressable style={styles.micBtn} onPress={() => { console.log("[ACTION] Opened Voice Input Modal"); setListening(true); }} disabled={loading}>
            <Ionicons name="mic" size={20} color={colors.ink} />
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => { console.log("[ACTION] Selected Keyboard input"); setShowKeyboard(true); }}>
            <Text style={styles.hint}>{loading ? "Processing..." : "Tap and speak, or type →"}</Text>
          </Pressable>
          <Pressable style={styles.kbdBtn} onPress={() => { console.log("[ACTION] Pressed Keyboard icon"); setShowKeyboard(true); }}>
            <Ionicons name="keypad-outline" size={18} color={colors.muted} />
          </Pressable>
        </View>

        {/* Listening overlay */}
        <ListeningOverlay
          visible={listening}
          onClose={() => { console.log("[ACTION] User manually closed voice input"); setListening(false); }}
          onSubmit={(text) => { console.log("[ACTION] Voice input submitted"); setListening(false); handleSend(text); }}
        />

        {/* Keyboard input modal */}
        <Modal
          visible={showKeyboard}
          onClose={() => setShowKeyboard(false)}
          title="Type your symptoms"
          containerStyle={{ padding: 16 }}
        >
          <View style={styles.kbContent}>
            <View style={styles.kbHeader}>
              <Text style={styles.kbTitle}>Type your symptoms</Text>
              <Pressable onPress={() => setShowKeyboard(false)}>
                <Ionicons name="close" size={24} color={colors.ink} />
              </Pressable>
            </View>
            <TextInput
              style={styles.kbInput}
              placeholder="e.g. I have headache and mild fever..."
              placeholderTextColor={colors.muted}
              value={textInput}
              onChangeText={setTextInput}
              multiline
              autoFocus
            />
            <Button
              label="ASK"
              icon={<Ionicons name="send" size={18} color={colors.ink} />}
              onPress={() => handleSend(textInput)}
              loading={loading}
              style={styles.modernBtn}
            />
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function ListeningOverlay({ visible, onClose, onSubmit }: { visible: boolean; onClose: () => void; onSubmit: (text: string) => void }) {
  const [input, setInput] = useState("");
  return (
    <Modal
      visible={visible}
      onClose={onClose}
      type="center"
      containerStyle={{ padding: 16 }}
    >
      <View style={styles.listenContent}>
        <View style={styles.ringsWrap}>
          <View style={styles.ringOuter} />
          <View style={styles.ringMid} />
          <View style={styles.ringInner}>
            <Ionicons name="mic" size={28} color={colors.ink} />
          </View>
        </View>
        <Text style={styles.listenTitle}>Listening…</Text>
        <Text style={styles.listenSub}>Describe your symptoms</Text>
        <TextInput
          style={styles.voiceInput}
          placeholder="(Type here to simulate voice input)"
          placeholderTextColor={colors.muted}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <View style={{ width: '100%', gap: 12, marginTop: 16 }}>
          <Button label="Submit" onPress={() => { onSubmit(input); setInput(""); }} />
          <Button label="Cancel" variant="outline" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  syncPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.greenTint, borderWidth: 1, borderColor: "rgba(19,236,91,0.35)" },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  syncText: { fontSize: 11, fontWeight: "900", color: colors.ink, letterSpacing: 0.6 },

  chat: { paddingTop: 12, paddingBottom: 120, gap: 10 },
  emptyState: { alignItems: "center", paddingVertical: 30, gap: 12 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(19,236,91,0.12)", alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "900", color: colors.ink },
  emptySub: { fontSize: 12, fontWeight: "700", color: colors.muted, textAlign: "center", lineHeight: 18, paddingHorizontal: 10 },
  exampleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 },
  exampleChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(139,94,60,0.08)", borderWidth: 1, borderColor: "rgba(139,94,60,0.18)" },
  exampleText: { fontSize: 11, fontWeight: "800", color: colors.earth },

  bubbleWrap: { width: "100%" },
  bubble: { maxWidth: "84%", borderRadius: 16, padding: 12, borderWidth: 1 },
  userBubble: { backgroundColor: "rgba(19,236,91,0.08)", borderColor: "rgba(19,236,91,0.25)" },
  aiBubble: { backgroundColor: colors.surface, borderColor: colors.border },
  bubbleText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  meta: { fontSize: 10, color: colors.muted, fontWeight: "700" },

  bottom: { position: "absolute", left: 14, right: 14, bottom: 12, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  micBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  hint: { flex: 1, color: colors.muted, fontWeight: "700" },
  kbdBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  /* ── Modern UI Styles ── */
  kbContent: {
    paddingBottom: 20,
  },
  kbHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  kbTitle: { fontSize: 18, fontWeight: "900", color: colors.ink },
  kbInput: { backgroundColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontWeight: "600", color: colors.ink, minHeight: 100, textAlignVertical: "top", marginBottom: 16 },
  modernBtn: { height: 56, borderRadius: 16 },

  listenContent: {
    alignItems: "center",
    padding: 10
  },
  ringsWrap: { width: 120, height: 120, alignItems: "center", justifyContent: "center", marginVertical: 20 },
  ringOuter: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(19,236,91,0.08)" },
  ringMid: { position: "absolute", width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(19,236,91,0.15)" },
  ringInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  listenTitle: { fontSize: 22, fontWeight: "900", color: colors.ink },
  listenSub: { marginTop: 4, fontSize: 14, fontWeight: "600", color: colors.muted, marginBottom: 20 },
  voiceInput: { width: "100%", backgroundColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontWeight: "600", color: colors.ink, minHeight: 80, textAlignVertical: "top" },
});

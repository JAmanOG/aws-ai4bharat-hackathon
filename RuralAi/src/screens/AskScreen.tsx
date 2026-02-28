import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

type Msg = { id: string; from: "user" | "ai"; text: string; status?: "queued" | "thinking" };

export default function AskScreen() {
  // demo states (later backend se drive karna)
  const [listening, setListening] = useState(false);
  const [offline, setOffline] = useState(false);     // demo: set true to test
  const [thinking, setThinking] = useState(false);   // demo

  const messages: Msg[] = useMemo(
    () => [
      { id: "1", from: "user", text: "How do I apply for the PM-Kisan scheme?", status: offline ? "queued" : undefined },
      {
        id: "2",
        from: "ai",
        text:
          "To apply for PM-Kisan, you need your Aadhaar card and land records. Register through the official portal or visit a Common Service Center.",
        status: thinking ? "thinking" : undefined,
      },
    ],
    [offline, thinking]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="menu" size={20} color={colors.ink} />
          </Pressable>

          <Text style={styles.title}>Ask</Text>

          <View style={styles.rightHeader}>
            <View style={styles.syncPill}>
              <View style={styles.syncDot} />
              <Text style={styles.syncText}>SYNCED</Text>
            </View>
          </View>
        </View>

        {/* Offline banner (as per figma offline screen) */}
        {offline && (
          <View style={styles.offlineBanner}>
            <View>
              <Text style={styles.offlineTitle}>Offline — using saved data</Text>
              <Text style={styles.offlineSub}>Connecting to network…</Text>
            </View>
            <Pressable style={styles.retryBtn} onPress={() => setOffline(false)}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Chat */}
        <ScrollView contentContainerStyle={styles.chat} showsVerticalScrollIndicator={false}>
          {messages.map((m) => (
            <ChatBubble key={m.id} msg={m} />
          ))}

          {/* Action chips (brown tinted) */}
          <View style={styles.chipRow}>
            <Chip icon="download-outline" label="Save offline" />
            <Chip icon="list-outline" label="Show steps" />
            <Chip icon="call-outline" label="Call helpline" />
            <Chip icon="open-outline" label="Open scheme" />
          </View>
        </ScrollView>

        {/* Bottom voice area */}
        <View style={styles.bottom}>
          <Pressable style={styles.micBtn} onPress={() => setListening(true)}>
            <Ionicons name="mic" size={20} color={colors.ink} />
          </Pressable>

          <Text style={styles.hint}>Tap and speak</Text>

          <Pressable style={styles.kbdBtn}>
            <Ionicons name="keypad-outline" size={18} color={colors.muted} />
          </Pressable>
        </View>

        {/* Listening overlay */}
        <ListeningOverlay
          visible={listening}
          onClose={() => setListening(false)}
          onCancel={() => setListening(false)}
        />
      </View>

      {/* Demo toggle (optional): long press anywhere to toggle offline */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onLongPress={() => setOffline((v) => !v)}
        delayLongPress={600}
      >
        <View />
      </Pressable>
    </SafeAreaView>
  );
}

function ChatBubble({ msg }: { msg: Msg }) {
  const isUser = msg.from === "user";
  return (
    <View style={[styles.bubbleWrap, isUser ? { alignItems: "flex-end" } : { alignItems: "flex-start" }]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.bubbleText, { color: colors.ink }]}>{msg.text}</Text>

        {msg.status === "queued" && (
          <Text style={styles.meta}>Queued • will send when online</Text>
        )}
        {msg.status === "thinking" && (
          <Text style={styles.meta}>Thinking…</Text>
        )}
      </View>
    </View>
  );
}

function Chip({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={14} color={colors.earth} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function ListeningOverlay({
  visible,
  onClose,
  onCancel,
}: {
  visible: boolean;
  onClose: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.listenCard}>
          <Pressable style={styles.closeX} onPress={onClose}>
            <Ionicons name="close" size={20} color={colors.ink} />
          </Pressable>

          <View style={styles.ringsWrap}>
            <View style={styles.ringOuter} />
            <View style={styles.ringMid} />
            <View style={styles.ringInner}>
              <Ionicons name="mic" size={28} color={colors.ink} />
            </View>
          </View>

          <Text style={styles.listenTitle}>Listening…</Text>
          <Text style={styles.listenSub}>Ask about crop prices</Text>

          <View style={styles.waveMini}>
            <View style={styles.bar} />
            <View style={[styles.bar, { height: 16 }]} />
            <View style={[styles.bar, { height: 24 }]} />
            <View style={[styles.bar, { height: 14 }]} />
            <View style={[styles.bar, { height: 20 }]} />
          </View>

          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
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
  rightHeader: { width: 86, alignItems: "flex-end" },
  syncPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.greenTint,
    borderWidth: 1,
    borderColor: "rgba(19,236,91,0.35)",
  },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  syncText: { fontSize: 11, fontWeight: "900", color: colors.ink, letterSpacing: 0.6 },

  offlineBanner: {
    marginTop: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  offlineTitle: { fontSize: 12, fontWeight: "900", color: colors.ink },
  offlineSub: { marginTop: 2, fontSize: 11, color: colors.muted },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  retryText: { fontSize: 12, fontWeight: "900", color: colors.ink },

  chat: { paddingTop: 12, paddingBottom: 120, gap: 10 },
  bubbleWrap: { width: "100%" },
  bubble: {
    maxWidth: "84%",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
  },
  userBubble: {
    backgroundColor: "rgba(19,236,91,0.08)",
    borderColor: "rgba(19,236,91,0.25)",
  },
  aiBubble: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  bubbleText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  meta: { marginTop: 8, fontSize: 10, color: colors.muted, fontWeight: "700" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.brownTint,
    borderWidth: 1,
    borderColor: "rgba(139,94,60,0.25)",
  },
  chipText: { fontSize: 11, fontWeight: "800", color: colors.earth },

  bottom: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { flex: 1, color: colors.muted, fontWeight: "700" },
  kbdBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.08)", alignItems: "center", justifyContent: "center", padding: 18 },
  listenCard: {
    width: "100%",
    backgroundColor: colors.bg,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  closeX: { alignSelf: "flex-end", width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  ringsWrap: { width: 180, height: 180, alignItems: "center", justifyContent: "center", marginTop: 6 },
  ringOuter: {
    position: "absolute",
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: "rgba(19,236,91,0.10)",
  },
  ringMid: {
    position: "absolute",
    width: 132, height: 132, borderRadius: 66,
    backgroundColor: "rgba(19,236,91,0.18)",
  },
  ringInner: {
    width: 92, height: 92, borderRadius: 46,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  listenTitle: { marginTop: 8, fontSize: 22, fontWeight: "900", color: colors.ink },
  listenSub: { marginTop: 6, fontSize: 12, fontWeight: "700", color: colors.muted },
  waveMini: { flexDirection: "row", gap: 6, marginTop: 14, alignItems: "flex-end", height: 26 },
  bar: { width: 6, height: 10, borderRadius: 3, backgroundColor: colors.primary, opacity: 0.9 },

  cancelBtn: { marginTop: 18, width: "100%", backgroundColor: colors.surface, borderRadius: 14, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  cancelText: { fontSize: 13, fontWeight: "900", color: colors.ink },
});
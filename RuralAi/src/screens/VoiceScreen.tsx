/**
 * Voice Chat Screen — conversational voice-first interface.
 * Shows Hindi voice bubbles, AI teal responses, camera CTA, user avatar.
 * Matches reference: "Tap to Speak", user (Hindi), AI contextual response.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";

/* ────────────── Types ────────────── */

type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
  lang?: string;
  timestamp: string;
};

/* ────────────── Waveform ────────────── */

function WaveBar({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 350, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.25, duration: 350, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, anim]);

  return <Animated.View style={[styles.waveBar, { transform: [{ scaleY: anim }] }]} />;
}

/* ────────────── Demo conversation seed ────────────── */

const DEMO_CONVO: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    text: "मेरी फसल के लिए सलाह",
    lang: "Hindi Voice",
    timestamp: "Just now",
  },
  {
    id: "2",
    role: "ai",
    text: 'कृपया अपनी फसल की फोटो लें ताकि में निदान कर सकूँ।',
    lang: "AI (Teal Response, Hindi)",
    timestamp: "Just now",
  },
];

/* ────────────── Component ────────────── */

export default function VoiceScreen() {
  const nav = useNavigation<any>();
  const [messages, setMessages] = useState<ChatMessage[]>(DEMO_CONVO);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  /* Pulse animation */
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!listening) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);

  const handleMicPress = () => {
    if (listening) {
      // Stop listening — simulate submit
      setListening(false);
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        text: "मेरी फसल में कीड़े लग गए हैं",
        lang: "Hindi Voice",
        timestamp: "Just now",
      };
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        text: "कृपया अपनी फसल की फोटो लें ताकि में निदान कर सकूँ।",
        lang: "AI (Text Response, Hindi)",
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } else {
      setListening(true);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Status bar ── */}
      <View style={styles.statusBar}>
        <Ionicons name="cloud-offline-outline" size={14} color={colors.muted} />
        <Text style={styles.statusText}>Offline</Text>
        <View style={styles.statusDivider} />
        <Ionicons name="sync-outline" size={13} color={colors.muted} />
        <Text style={styles.statusText}>Offline Mode - Sync Pending</Text>
      </View>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>RURAL ECOSYSTEM PLATFORM</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Chat area ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Mic section at top */}
          <View style={styles.voiceSection}>
            <Text style={styles.tapLabel}>Tap to Speak</Text>
            <Text style={styles.tapHintHindi}>मेरी फसल के लिए सलाह</Text>

            {/* Waveform + Mic */}
            <View style={styles.micRow}>
              <View style={styles.waveRow}>
                {[0, 50, 100, 30, 70].map((d, i) => (
                  <WaveBar key={`l${i}`} delay={d} />
                ))}
              </View>

              <View style={styles.micWrap}>
                <Animated.View
                  style={[styles.micPulse, listening && { transform: [{ scale: pulse }] }]}
                />
                <Pressable style={styles.micBtn} onPress={handleMicPress}>
                  <Ionicons name="mic" size={30} color="#FFF" />
                </Pressable>
              </View>

              <View style={styles.waveRow}>
                {[20, 80, 40, 90, 10].map((d, i) => (
                  <WaveBar key={`r${i}`} delay={d} />
                ))}
              </View>
            </View>

            {listening && <Text style={styles.listeningText}>Listening…</Text>}
          </View>

          {/* Chat bubbles */}
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[styles.bubble, msg.role === "user" ? styles.userBubble : styles.aiBubble]}
            >
              {msg.lang && (
                <Text style={[styles.bubbleLabel, msg.role === "ai" && { color: colors.primary }]}>
                  {msg.lang}:
                </Text>
              )}
              <Text style={styles.bubbleText}>
                {msg.role === "user" ? `"${msg.text}"` : `"${msg.text}"`}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* ── Bottom bar: Camera + Profile ── */}
        <View style={styles.bottomBar}>
          <Pressable style={styles.cameraBtn}>
            <Ionicons name="camera" size={22} color="#FFF" />
          </Pressable>

          <View style={{ flex: 1 }} />

          <Pressable style={styles.profileBtn} onPress={() => nav.navigate("Profile")}>
            <Ionicons name="person" size={14} color={colors.muted} />
            <Text style={styles.profileText}>AJ</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ────────────── Styles ────────────── */

const MIC = 64;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  /* Status */
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 5,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusText: { fontSize: 11, fontWeight: "600", color: colors.muted },
  statusDivider: { width: 1, height: 12, backgroundColor: colors.border, marginHorizontal: 4 },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: 1,
  },

  /* Chat */
  chatArea: { flex: 1 },
  chatContent: { paddingHorizontal: 16, paddingBottom: 10 },

  /* Voice section */
  voiceSection: {
    alignItems: "center",
    paddingVertical: 18,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tapLabel: { fontSize: 18, fontWeight: "900", color: colors.ink },
  tapHintHindi: { marginTop: 4, fontSize: 13, fontWeight: "600", color: colors.muted },
  listeningText: { marginTop: 6, fontSize: 13, fontWeight: "700", color: colors.primary },

  micRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    gap: 6,
  },
  waveRow: { flexDirection: "row", gap: 3, height: 22, alignItems: "center" },
  waveBar: { width: 3, height: 20, borderRadius: 1.5, backgroundColor: colors.primary },

  micWrap: { alignItems: "center", justifyContent: "center", width: MIC + 20, height: MIC + 20 },
  micPulse: {
    position: "absolute",
    width: MIC + 18,
    height: MIC + 18,
    borderRadius: (MIC + 18) / 2,
    backgroundColor: "rgba(74,144,217,0.15)",
  },
  micBtn: {
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },

  /* Bubbles */
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#E8EDF2",
    borderTopLeftRadius: 4,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#E0F0FF",
    borderTopLeftRadius: 4,
  },
  bubbleLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted,
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  bubbleText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    lineHeight: 19,
  },

  /* Bottom bar */
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  cameraBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  profileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileText: { fontSize: 11, fontWeight: "800", color: colors.muted },
});

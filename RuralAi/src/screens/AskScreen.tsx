/**
 * Ask Screen — voice-first landing page matching mockup design.
 * Large centered mic with animated waveform, conversation bubbles,
 * domain quick-access grid, camera FAB, profile badge.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useVoiceService } from "../services/voice";
import { useAuth } from "../contexts/AuthContext";

const { width: SCREEN_W } = Dimensions.get("window");

/* ── Animated waveform bar ── */
function WaveBar({ delay, active, height = 22 }: { delay: number; active: boolean; height?: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    if (!active) { anim.setValue(0.3); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 350 + delay, delay: delay * 0.5, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 350, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, delay, anim]);
  return (
    <Animated.View
      style={[
        styles.waveBar,
        { height, transform: [{ scaleY: anim }], backgroundColor: active ? colors.primary : "#BDD4EE" },
      ]}
    />
  );
}

/* ── Domain grid items ── */
const DOMAINS = [
  { key: "agriculture", title: "Agriculture", icon: "leaf-outline", screen: "AgriMarket" },
  { key: "knowledge", title: "Knowledge", icon: "bulb-outline", screen: "KnowledgeDashboard" },
  { key: "economics", title: "Economics", icon: "business-outline", screen: "SavingsNudge" },
  { key: "health", title: "Health", icon: "heart-circle-outline", screen: "SymptomChecker" },
  { key: "infra", title: "Infrastructure", icon: "grid-outline", screen: "SyncStatus" },
];

/* ── Chat bubble ── */
function ChatBubble({ role, text }: { role: "user" | "ai"; text: string }) {
  const isUser = role === "user";
  return (
    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
      <Text style={[styles.bubbleLabel, isUser ? styles.bubbleLabelUser : styles.bubbleLabelAi]}>
        {isUser ? "User (Hindi Voice):" : "AI (Response, Hindi):"}
      </Text>
      <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAi]}>{text}</Text>
    </View>
  );
}

/* ── Main Component ── */
export default function AskScreen() {
  const nav = useNavigation<any>();
  const voice = useVoiceService();
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [userText, setUserText] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [lastDomain, setLastDomain] = useState<string | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);

  /* Pulse for recording */
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!recording) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  /* Idle gentle pulse */
  const idlePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (recording) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idlePulse, { toValue: 1.06, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(idlePulse, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, idlePulse]);

  useEffect(() => { voice.requestMicPermission().then(setHasMicPermission); }, []);

  const handleMicPress = useCallback(async () => {
    if (processing) return;
    if (recording) {
      setRecording(false);
      setProcessing(true);
      try {
        const uri = await voice.stopRecording();
        if (!uri) { setProcessing(false); return; }
        const response = await fetch(uri);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => { resolve((reader.result as string).split(",")[1] || ""); };
          reader.readAsDataURL(blob);
        });
        if (!base64) { setProcessing(false); return; }
        const chatResult = await voice.chatWithAudio(base64, { language_code: "unknown" });
        setUserText(chatResult.transcript ?? null);
        setAiResponse(chatResult.response_text);
        setLastDomain(chatResult.domain ?? null);
        if (chatResult.audio_base64) voice.playBase64Audio(chatResult.audio_base64).catch(() => {});
      } catch (err: any) {
        setAiResponse(`Error: ${err.message || "Something went wrong"}`);
      } finally { setProcessing(false); }
    } else {
      if (hasMicPermission === false) { Alert.alert("Microphone Permission", "Please enable microphone access in Settings."); return; }
      try {
        await voice.startRecording();
        setRecording(true);
        setUserText(null); setAiResponse(null); setLastDomain(null);
      } catch (err: any) { Alert.alert("Recording Error", err.message || "Could not start recording"); }
    }
  }, [recording, processing, hasMicPermission, voice]);

  const initials = user?.name ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : "U";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        {/* Title */}
        <Text style={styles.platformTitle}>RURAL ECOSYSTEM PLATFORM</Text>
        <Text style={styles.hindiSub}>मेरी फसल के लिए सलाह</Text>

        {/* Mic + Waveform */}
        <View style={styles.micArea}>
          <View style={styles.waveSection}>
            {[0, 60, 120, 40, 100].map((d, i) => (
              <WaveBar key={`l${i}`} delay={d} active={recording} height={18 + (i % 3) * 8} />
            ))}
          </View>
          <View style={styles.micWrap}>
            <Animated.View style={[styles.micRingOuter, { transform: [{ scale: recording ? pulse : idlePulse }] }]} />
            <Animated.View style={[styles.micRingMiddle, { transform: [{ scale: recording ? pulse : idlePulse }], opacity: recording ? 0.6 : 0.3 }]} />
            <Pressable style={[styles.micBtn, processing && { opacity: 0.7 }]} onPress={handleMicPress} disabled={processing}>
              {processing ? <ActivityIndicator size="large" color="#FFF" /> : <Ionicons name={recording ? "stop" : "mic"} size={36} color="#FFF" />}
            </Pressable>
          </View>
          <View style={styles.waveSection}>
            {[20, 80, 40, 90, 10].map((d, i) => (
              <WaveBar key={`r${i}`} delay={d} active={recording} height={18 + (i % 3) * 8} />
            ))}
          </View>
        </View>

        <Text style={styles.tapLabel}>
          {recording ? "Listening... tap to stop" : processing ? "Processing..." : "Tap to Speak"}
        </Text>

        {/* Chat bubbles */}
        {(userText || aiResponse) && (
          <View style={styles.chatSection}>
            {userText && <ChatBubble role="user" text={userText} />}
            {aiResponse && <ChatBubble role="ai" text={aiResponse} />}
          </View>
        )}

        {!userText && !aiResponse && !recording && !processing && (
          <Text style={styles.helperText}>Example: Ask about crop prices in Hindi...</Text>
        )}

        {/* Domain grid */}
        <View style={styles.domainGrid}>
          {DOMAINS.map((d) => (
            <Pressable key={d.key} style={styles.domainTile} onPress={() => nav.navigate("Home", { screen: d.screen })}>
              <View style={styles.domainIcon}>
                <Ionicons name={d.icon as any} size={24} color={colors.primary} />
              </View>
              <Text style={styles.domainLabel}>{d.title}</Text>
            </Pressable>
          ))}
        </View>

        {/* Full chat link */}
        <Pressable style={styles.chatLink} onPress={() => nav.navigate("Home", { screen: "Voice" })}>
          <Ionicons name="chatbubbles-outline" size={16} color={colors.primary} />
          <Text style={styles.chatLinkText}>Open Full Chat</Text>
        </Pressable>
      </ScrollView>

      {/* Camera FAB */}
      <Pressable style={styles.cameraFab} onPress={() => Alert.alert("Camera", "Crop pest image capture — coming soon!")}>
        <Ionicons name="camera" size={22} color="#FFF" />
      </Pressable>

      {/* Profile badge */}
      <Pressable style={styles.profileBadge} onPress={() => nav.navigate("Profile")}>
        <Ionicons name="person" size={12} color={colors.muted} />
        <Text style={styles.profileText}>{initials}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const MIC = 88;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { alignItems: "center", paddingHorizontal: 20, paddingBottom: 100, paddingTop: 14 },
  platformTitle: { fontSize: 15, fontWeight: "900", color: colors.ink, letterSpacing: 2, textAlign: "center" },
  hindiSub: { marginTop: 6, fontSize: 14, fontWeight: "600", color: colors.muted, textAlign: "center" },
  micArea: { marginTop: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  waveSection: { flexDirection: "row", alignItems: "center", gap: 3, height: 40 },
  waveBar: { width: 3.5, borderRadius: 2 },
  micWrap: { width: MIC + 40, height: MIC + 40, alignItems: "center", justifyContent: "center" },
  micRingOuter: { position: "absolute", width: MIC + 36, height: MIC + 36, borderRadius: (MIC + 36) / 2, backgroundColor: "rgba(74,144,217,0.10)" },
  micRingMiddle: { position: "absolute", width: MIC + 16, height: MIC + 16, borderRadius: (MIC + 16) / 2, backgroundColor: "rgba(74,144,217,0.18)" },
  micBtn: { width: MIC, height: MIC, borderRadius: MIC / 2, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  tapLabel: { marginTop: 16, fontSize: 17, fontWeight: "800", color: colors.ink, textAlign: "center" },
  helperText: { marginTop: 6, fontSize: 12, fontWeight: "500", color: colors.muted, textAlign: "center" },
  chatSection: { width: "100%", marginTop: 18, gap: 10 },
  bubble: { borderRadius: 14, padding: 12, maxWidth: "92%" },
  bubbleUser: { backgroundColor: "#E8F0FE", alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  bubbleAi: { backgroundColor: "#E0F2F1", alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleLabel: { fontSize: 10, fontWeight: "800", marginBottom: 4, letterSpacing: 0.3 },
  bubbleLabelUser: { color: colors.primary },
  bubbleLabelAi: { color: "#00796B" },
  bubbleText: { fontSize: 13, fontWeight: "600", lineHeight: 19 },
  bubbleTextUser: { color: colors.ink },
  bubbleTextAi: { color: "#1B5E20" },
  domainGrid: { marginTop: 24, width: "100%", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 },
  domainTile: { width: (SCREEN_W - 80) / 3, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: 16, alignItems: "center", gap: 8, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  domainIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(74,144,217,0.08)", alignItems: "center", justifyContent: "center" },
  domainLabel: { fontSize: 11, fontWeight: "800", color: colors.ink, letterSpacing: 0.3 },
  chatLink: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.primaryTint },
  chatLinkText: { fontSize: 12, fontWeight: "800", color: colors.primary },
  cameraFab: { position: "absolute", bottom: 24, left: 24, width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  profileBadge: { position: "absolute", bottom: 28, right: 24, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  profileText: { fontSize: 11, fontWeight: "900", color: colors.ink },
});

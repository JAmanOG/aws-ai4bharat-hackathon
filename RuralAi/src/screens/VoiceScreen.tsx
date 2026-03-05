/**
 * Voice Chat Screen — Voice-first conversational interface.
 *
 * Design principles (user vision):
 *   - Everything visual: responses rendered as rich cards, not plain text bubbles.
 *   - Voice-first: mic is always prominent, text input hidden until user taps "Type instead".
 *   - Domain/intent badges show what pipeline understood.
 *   - Audio auto-plays and can be replayed.
 *   - Proper logging at every stage for debugging.
 *
 * Uses the single /voice/chat/audio pipeline endpoint (STT → Nova → Agent → TTS).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useVoiceService, type ChatResult } from "../services/voice";
import { logger } from "../utils/logger";

/* ────────────── Types ────────────── */

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  audioBase64?: string;
  isLoading?: boolean;
  /** Orchestrator metadata (assistant messages only) */
  domain?: string;
  intent?: string;
  entities?: Record<string, string>;
  complexity?: string;
  route?: string;
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

/* ────────────── Language Picker ────────────── */

const QUICK_LANGS = [
  { code: "hi", label: "हिंदी" },
  { code: "en", label: "English" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "bn", label: "বাংলা" },
  { code: "mr", label: "मराठी" },
];

/* ────────────── Domain helpers ────────────── */

const DOMAIN_META: Record<string, { icon: string; color: string; label: string }> = {
  agriculture: { icon: "leaf", color: "#2E7D32", label: "Agriculture" },
  market: { icon: "trending-up", color: "#1565C0", label: "Market" },
  schemes: { icon: "document-text", color: "#6A1B9A", label: "Schemes" },
  weather: { icon: "cloud", color: "#00838F", label: "Weather" },
  health: { icon: "medkit", color: "#C62828", label: "Health" },
  finance: { icon: "wallet", color: "#EF6C00", label: "Finance" },
  general: { icon: "chatbubble-ellipses", color: colors.primary, label: "General" },
};

function getDomainMeta(domain?: string) {
  return DOMAIN_META[domain ?? "general"] ?? DOMAIN_META.general;
}

/* ────────────── Visual Response Card ────────────── */

function ResponseCard({ msg, onReplay }: { msg: ChatMessage; onReplay: () => void }) {
  const dm = getDomainMeta(msg.domain);

  return (
    <View style={styles.responseCard}>
      {/* Domain + Intent header */}
      {msg.domain && (
        <View style={styles.cardHeader}>
          <View style={[styles.domainBadge, { backgroundColor: dm.color + "18" }]}>
            <Ionicons name={dm.icon as any} size={13} color={dm.color} />
            <Text style={[styles.domainLabel, { color: dm.color }]}>{dm.label}</Text>
          </View>
          {msg.intent && (
            <Text style={styles.intentLabel}>{msg.intent.replace(/_/g, " ")}</Text>
          )}
        </View>
      )}

      {/* Entities (key-value tags) */}
      {msg.entities && Object.keys(msg.entities).length > 0 && (
        <View style={styles.entityRow}>
          {Object.entries(msg.entities).map(([k, v]) => (
            <View key={k} style={styles.entityTag}>
              <Text style={styles.entityKey}>{k}:</Text>
              <Text style={styles.entityVal}>{v}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Response text */}
      <Text style={styles.cardText}>{msg.text}</Text>

      {/* Footer: time + replay */}
      <View style={styles.cardFooter}>
        <Text style={styles.cardTime}>{msg.timestamp}</Text>
        {msg.audioBase64 ? (
          <Pressable onPress={onReplay} style={styles.replayBtn} hitSlop={8}>
            <Ionicons name="volume-medium" size={16} color={colors.primary} />
            <Text style={styles.replayLabel}>Replay</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/* ────────────── Component ────────────── */

export default function VoiceScreen() {
  const nav = useNavigation<any>();
  const voice = useVoiceService();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [inputText, setInputText] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [language, setLanguage] = useState("hi");
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  /* Pulse animation for mic */
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!recording) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  /* Request mic on mount */
  useEffect(() => {
    logger.info("VoiceScreen", "Mounted, requesting mic permission");
    voice.requestMicPermission().then((granted) => {
      logger.info("VoiceScreen", `Mic permission: ${granted ? "granted" : "denied"}`);
      setHasMicPermission(granted);
    });
  }, []);

  /* Scroll to bottom on new message */
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [messages.length]);

  /* ── Helper: build assistant ChatMessage from ChatResult ── */
  const buildAssistantMsg = useCallback((result: ChatResult): ChatMessage => ({
    id: (Date.now() + Math.random()).toString(),
    role: "assistant",
    text: result.response_text,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    audioBase64: result.audio_base64,
    domain: result.domain,
    intent: result.intent,
    entities: result.entities,
    complexity: result.complexity,
    route: result.route,
  }), []);

  /* ── Send text message ── */
  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim() || processing) return;
    logger.info("VoiceScreen", `Sending text: "${text.trim().substring(0, 50)}..."`);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const loadingMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      text: "",
      timestamp: "",
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInputText("");
    setProcessing(true);

    try {
      const start = Date.now();
      const result = await voice.chatWithText(text.trim(), {
        language_code: language,
        session_id: sessionId,
        generate_audio: true,
      });
      logger.info("VoiceScreen", `Text chat response in ${Date.now() - start}ms — domain=${result.domain}, intent=${result.intent}`);

      if (!sessionId) setSessionId(result.session_id);

      const aiMsg = buildAssistantMsg(result);
      setMessages((prev) => prev.filter((m) => !m.isLoading).concat(aiMsg));

      // Auto-play audio
      if (result.audio_base64) {
        logger.debug("VoiceScreen", "Playing TTS audio");
        voice.playBase64Audio(result.audio_base64).catch((e) => {
          logger.warn("VoiceScreen", `TTS playback error: ${e.message}`);
        });
      }
    } catch (err: any) {
      logger.error("VoiceScreen", `Text chat error: ${err.message}`, err);
      setMessages((prev) =>
        prev.filter((m) => !m.isLoading).concat({
          id: (Date.now() + 2).toString(),
          role: "assistant",
          text: `Error: ${err.message || "Could not get response"}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }),
      );
    } finally {
      setProcessing(false);
    }
  }, [language, sessionId, processing, buildAssistantMsg]);

  /* ── Mic press ── */
  const handleMicPress = useCallback(async () => {
    if (processing) return;

    if (recording) {
      // Stop recording → single /voice/chat/audio pipeline call
      setRecording(false);
      setProcessing(true);
      logger.info("VoiceScreen", "Stopped recording, starting audio pipeline");

      try {
        const uri = await voice.stopRecording();
        if (!uri) {
          logger.warn("VoiceScreen", "No recording URI returned");
          setProcessing(false);
          return;
        }
        logger.debug("VoiceScreen", `Recording URI: ${uri}`);

        // Read file as base64
        const response = await fetch(uri);
        const blob = await response.blob();
        logger.debug("VoiceScreen", `Audio blob size: ${blob.size} bytes`);
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(",")[1] || "");
          };
          reader.readAsDataURL(blob);
        });

        if (!base64) {
          logger.warn("VoiceScreen", "Empty base64 after conversion");
          setProcessing(false);
          return;
        }
        logger.info("VoiceScreen", `Audio base64 length: ${base64.length} chars (~${Math.round(base64.length * 0.75 / 1024)}KB)`);

        // Add processing indicator
        const loadingMsg: ChatMessage = {
          id: Date.now().toString(),
          role: "assistant",
          text: "",
          timestamp: "",
          isLoading: true,
        };
        setMessages((prev) => [...prev, loadingMsg]);

        // Single API call — full audio pipeline (Transcribe → Nova → Agent → Sarvam TTS)
        const start = Date.now();
        logger.info("VoiceScreen", `Calling /voice/chat/audio (lang=${language}, session=${sessionId ?? "new"})`);
        const chatResult = await voice.chatWithAudio(base64, {
          language_code: language,
          session_id: sessionId,
        });
        logger.info("VoiceScreen", `Audio pipeline response in ${Date.now() - start}ms — domain=${chatResult.domain}, intent=${chatResult.intent}, route=${chatResult.route}`);

        if (!sessionId) setSessionId(chatResult.session_id);

        // Show user's transcribed speech
        const transcript = chatResult.transcript;
        if (transcript && transcript.trim()) {
          logger.info("VoiceScreen", `Transcript: "${transcript.substring(0, 80)}..."`);
          const userMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: "user",
            text: transcript,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => {
            const withoutLoading = prev.filter((m) => !m.isLoading);
            return [...withoutLoading, userMsg];
          });
        } else {
          logger.debug("VoiceScreen", "No transcript in response (text-only or direct answer)");
          setMessages((prev) => prev.filter((m) => !m.isLoading));
        }

        // Show assistant response as visual card
        const aiMsg = buildAssistantMsg(chatResult);
        setMessages((prev) => prev.filter((m) => !m.isLoading).concat(aiMsg));

        // Auto-play
        if (chatResult.audio_base64) {
          logger.debug("VoiceScreen", "Playing TTS audio response");
          voice.playBase64Audio(chatResult.audio_base64).catch((e) => {
            logger.warn("VoiceScreen", `TTS playback error: ${e.message}`);
          });
        }
      } catch (err: any) {
        logger.error("VoiceScreen", `Audio pipeline error: ${err.message}`, err);
        setMessages((prev) =>
          prev.filter((m) => !m.isLoading).concat({
            id: (Date.now() + 4).toString(),
            role: "assistant",
            text: `Error: ${err.message || "Voice processing failed"}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }),
        );
      } finally {
        setProcessing(false);
      }
    } else {
      // Start recording
      if (hasMicPermission === false) {
        Alert.alert("Microphone Permission", "Please enable microphone access in Settings.");
        return;
      }
      try {
        logger.info("VoiceScreen", "Starting recording");
        await voice.startRecording();
        setRecording(true);
      } catch (err: any) {
        logger.error("VoiceScreen", `Recording start error: ${err.message}`, err);
        Alert.alert("Recording Error", err.message || "Could not start recording");
      }
    }
  }, [recording, processing, language, sessionId, hasMicPermission, buildAssistantMsg]);

  /* ── Replay audio ── */
  const handleReplay = useCallback((audioBase64?: string) => {
    if (audioBase64) {
      logger.debug("VoiceScreen", "Replaying audio");
      voice.playBase64Audio(audioBase64).catch(() => {});
    }
  }, []);

  /* ── New session ── */
  const handleNewSession = useCallback(() => {
    logger.info("VoiceScreen", "Starting new session");
    setMessages([]);
    setSessionId(undefined);
    setShowTextInput(false);
    voice.stopPlayback().catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ── */}
      <View style={styles.header}>
        {nav.canGoBack() ? (
          <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.headerTitle}>Voice Assistant</Text>
        <Pressable style={styles.backBtn} onPress={handleNewSession}>
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {/* ── Language selector ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.langBar} contentContainerStyle={styles.langBarContent}>
        {QUICK_LANGS.map((l) => (
          <Pressable
            key={l.code}
            style={[styles.langChip, language === l.code && styles.langChipActive]}
            onPress={() => setLanguage(l.code)}
          >
            <Text style={[styles.langChipText, language === l.code && styles.langChipTextActive]}>
              {l.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* ── Chat area ── */}
        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="mic" size={40} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Voice Assistant</Text>
              <Text style={styles.emptyHint}>
                Tap the mic to speak. I'll show you visual responses{"\n"}
                for farming, market prices, weather, schemes & more.
              </Text>
              <View style={styles.featureGrid}>
                {[
                  { icon: "leaf", label: "Crop Advice" },
                  { icon: "trending-up", label: "Market Prices" },
                  { icon: "cloud", label: "Weather" },
                  { icon: "document-text", label: "Govt Schemes" },
                ].map((f) => (
                  <View key={f.label} style={styles.featureItem}>
                    <Ionicons name={f.icon as any} size={20} color={colors.primary} />
                    <Text style={styles.featureLabel}>{f.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {messages.map((msg) => {
            if (msg.isLoading) {
              return (
                <View key={msg.id} style={styles.loadingCard}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Processing your voice...</Text>
                </View>
              );
            }

            if (msg.role === "user") {
              return (
                <View key={msg.id} style={styles.userBubble}>
                  <Ionicons name="person-circle" size={18} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.userBubbleText}>{msg.text}</Text>
                </View>
              );
            }

            // Assistant — rich visual card
            return (
              <ResponseCard
                key={msg.id}
                msg={msg}
                onReplay={() => handleReplay(msg.audioBase64)}
              />
            );
          })}
        </ScrollView>

        {/* ── Bottom voice + optional text ── */}
        <View style={styles.inputArea}>
          {/* Mic row */}
          <View style={styles.micRow}>
            {recording && (
              <View style={styles.waveRow}>
                {[0, 50, 100, 30, 70].map((d, i) => (
                  <WaveBar key={`l${i}`} delay={d} />
                ))}
              </View>
            )}

            <View style={styles.micWrap}>
              {recording && (
                <Animated.View style={[styles.micPulse, { transform: [{ scale: pulse }] }]} />
              )}
              <Pressable
                style={[styles.micBtn, processing && styles.micBtnDisabled]}
                onPress={handleMicPress}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name={recording ? "stop" : "mic"} size={28} color="#FFF" />
                )}
              </Pressable>
            </View>

            {recording && (
              <View style={styles.waveRow}>
                {[20, 80, 40, 90, 10].map((d, i) => (
                  <WaveBar key={`r${i}`} delay={d} />
                ))}
              </View>
            )}
          </View>

          {recording && <Text style={styles.listeningText}>Listening... tap to stop</Text>}

          {/* "Type instead" toggle — text input only shows when user explicitly asks */}
          {!showTextInput && !recording && !processing && (
            <Pressable style={styles.typeToggle} onPress={() => setShowTextInput(true)}>
              <Ionicons name="keypad-outline" size={14} color={colors.muted} />
              <Text style={styles.typeToggleText}>Type instead</Text>
            </Pressable>
          )}

          {showTextInput && (
            <View style={styles.textInputRow}>
              <TextInput
                style={styles.textInput}
                placeholder="Type your question..."
                placeholderTextColor={colors.muted}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => sendTextMessage(inputText)}
                editable={!processing && !recording}
                returnKeyType="send"
                autoFocus
              />
              <Pressable
                style={[styles.sendBtn, (!inputText.trim() || processing) && styles.sendBtnDisabled]}
                onPress={() => sendTextMessage(inputText)}
                disabled={!inputText.trim() || processing}
              >
                <Ionicons name="send" size={18} color="#FFF" />
              </Pressable>
              <Pressable style={styles.closeTextBtn} onPress={() => { setShowTextInput(false); setInputText(""); }}>
                <Ionicons name="close-circle" size={22} color={colors.muted} />
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ────────────── Styles ────────────── */

const MIC = 56;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
  },

  /* Language bar */
  langBar: { maxHeight: 44, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  langBarContent: { paddingHorizontal: 12, alignItems: "center", gap: 8, paddingVertical: 6 },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  langChipText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  langChipTextActive: { color: "#FFF" },

  /* Chat */
  chatArea: { flex: 1 },
  chatContent: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },

  /* Empty state */
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 50 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: colors.ink, marginBottom: 8 },
  emptyHint: { fontSize: 13, fontWeight: "600", color: colors.muted, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  featureItem: {
    width: 100,
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureLabel: { fontSize: 11, fontWeight: "700", color: colors.ink },

  /* User bubble — compact */
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  userBubbleText: { fontSize: 14, fontWeight: "600", color: "#FFF", lineHeight: 20, flexShrink: 1 },

  /* Response card — visual */
  responseCard: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  domainBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  domainLabel: { fontSize: 11, fontWeight: "800" },
  intentLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "capitalize",
  },
  entityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  entityTag: {
    flexDirection: "row",
    gap: 3,
    backgroundColor: colors.bg,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  entityKey: { fontSize: 10, fontWeight: "800", color: colors.muted },
  entityVal: { fontSize: 10, fontWeight: "700", color: colors.ink },
  cardText: { fontSize: 14, fontWeight: "600", color: colors.ink, lineHeight: 21 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cardTime: { fontSize: 10, fontWeight: "600", color: colors.muted },
  replayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: colors.primaryTint,
  },
  replayLabel: { fontSize: 11, fontWeight: "700", color: colors.primary },

  /* Loading card */
  loadingCard: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  loadingText: { fontSize: 13, fontWeight: "600", color: colors.muted },

  /* Input area */
  inputArea: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },

  /* Mic row */
  micRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    gap: 8,
  },
  waveRow: { flexDirection: "row", gap: 3, height: 22, alignItems: "center" },
  waveBar: { width: 3, height: 20, borderRadius: 1.5, backgroundColor: colors.primary },
  micWrap: { alignItems: "center", justifyContent: "center", width: MIC + 16, height: MIC + 16 },
  micPulse: {
    position: "absolute",
    width: MIC + 14,
    height: MIC + 14,
    borderRadius: (MIC + 14) / 2,
    backgroundColor: "rgba(74,144,217,0.15)",
  },
  micBtn: {
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  micBtnDisabled: { opacity: 0.6 },
  listeningText: { textAlign: "center", fontSize: 12, fontWeight: "700", color: colors.primary, marginBottom: 4 },

  /* Type instead toggle */
  typeToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
  },
  typeToggleText: { fontSize: 12, fontWeight: "600", color: colors.muted },

  /* Text input (hidden by default) */
  textInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  textInput: {
    flex: 1,
    height: 42,
    backgroundColor: colors.bg,
    borderRadius: 21,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  closeTextBtn: { padding: 4 },
});

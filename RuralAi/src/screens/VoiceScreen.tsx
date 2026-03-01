/**
 * Voice Chat Screen — real voice-first conversational interface.
 * Uses Sarvam AI for STT/TTS, LLM chain for responses, DynamoDB for memory.
 * Supports 22 Indian languages with auto-detection.
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
import * as voiceService from "../services/voice";

/* ────────────── Types ────────────── */

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  audioBase64?: string;
  isLoading?: boolean;
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

/* ────────────── Component ────────────── */

export default function VoiceScreen() {
  const nav = useNavigation<any>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [inputText, setInputText] = useState("");
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
    voiceService.requestMicPermission().then(setHasMicPermission);
  }, []);

  /* Scroll to bottom on new message */
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [messages.length]);

  /* ── Send text message ── */
  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim() || processing) return;

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
      const result = await voiceService.chatWithText(text.trim(), {
        language_code: language,
        session_id: sessionId,
        generate_audio: true,
      });

      if (!sessionId) setSessionId(result.session_id);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        text: result.response_text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        audioBase64: result.audio_base64,
      };

      setMessages((prev) => prev.filter((m) => !m.isLoading).concat(aiMsg));

      // Auto-play audio
      if (result.audio_base64) {
        voiceService.playBase64Audio(result.audio_base64).catch(() => {});
      }
    } catch (err: any) {
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
  }, [language, sessionId, processing]);

  /* ── Mic press ── */
  const handleMicPress = useCallback(async () => {
    if (processing) return;

    if (recording) {
      // Stop recording → send
      setRecording(false);
      setProcessing(true);

      try {
        const uri = await voiceService.stopRecording();
        if (!uri) {
          setProcessing(false);
          return;
        }

        // Read file as base64
        const response = await fetch(uri);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(",")[1] || "");
          };
          reader.readAsDataURL(blob);
        });

        if (!base64) {
          setProcessing(false);
          return;
        }

        // Add "processing" indicator
        const loadingMsg: ChatMessage = {
          id: Date.now().toString(),
          role: "assistant",
          text: "",
          timestamp: "",
          isLoading: true,
        };
        setMessages((prev) => [...prev, loadingMsg]);

        // Call backend audio chat endpoint via text – transcribe + chat
        // Use the transcribe API first, then chat with text
        const transcribeRes = await fetch(
          `${require("../config/env").ENV.API_BASE_URL}/voice/transcribe`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-Id": require("../config/env").ENV.DEMO_USER_ID,
            },
            body: JSON.stringify({
              audio_base64: base64,
              language_code: language,
            }),
          },
        );
        const transcribeData = await transcribeRes.json();
        const transcript = transcribeData.transcript || "";

        if (!transcript.trim()) {
          setMessages((prev) =>
            prev.filter((m) => !m.isLoading).concat({
              id: (Date.now() + 1).toString(),
              role: "assistant",
              text: "Could not understand audio. Please try again.",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            }),
          );
          setProcessing(false);
          return;
        }

        // Show user message with transcript
        const userMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "user",
          text: transcript,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => {
          const withoutLoading = prev.filter((m) => !m.isLoading);
          return [...withoutLoading, userMsg, { ...loadingMsg, id: (Date.now() + 2).toString() }];
        });

        // Chat with transcribed text
        const chatResult = await voiceService.chatWithText(transcript, {
          language_code: transcribeData.language_code || language,
          session_id: sessionId,
          generate_audio: true,
        });

        if (!sessionId) setSessionId(chatResult.session_id);

        const aiMsg: ChatMessage = {
          id: (Date.now() + 3).toString(),
          role: "assistant",
          text: chatResult.response_text,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          audioBase64: chatResult.audio_base64,
        };

        setMessages((prev) => prev.filter((m) => !m.isLoading).concat(aiMsg));

        if (chatResult.audio_base64) {
          voiceService.playBase64Audio(chatResult.audio_base64).catch(() => {});
        }
      } catch (err: any) {
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
        await voiceService.startRecording();
        setRecording(true);
      } catch (err: any) {
        Alert.alert("Recording Error", err.message || "Could not start recording");
      }
    }
  }, [recording, processing, language, sessionId, hasMicPermission]);

  /* ── Replay audio ── */
  const handleReplay = useCallback((audioBase64?: string) => {
    if (audioBase64) {
      voiceService.playBase64Audio(audioBase64).catch(() => {});
    }
  }, []);

  /* ── New session ── */
  const handleNewSession = useCallback(() => {
    setMessages([]);
    setSessionId(undefined);
    voiceService.stopPlayback().catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => nav.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
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
                Tap the mic to speak, or type your question below.{"\n"}
                Supports Hindi, English, Tamil, Telugu & more.
              </Text>
            </View>
          )}

          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[styles.bubble, msg.role === "user" ? styles.userBubble : styles.aiBubble]}
            >
              {msg.isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Thinking...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.bubbleText}>{msg.text}</Text>
                  <View style={styles.bubbleMeta}>
                    <Text style={styles.bubbleTime}>{msg.timestamp}</Text>
                    {msg.role === "assistant" && msg.audioBase64 ? (
                      <Pressable onPress={() => handleReplay(msg.audioBase64)} style={styles.replayBtn}>
                        <Ionicons name="volume-medium" size={14} color={colors.primary} />
                      </Pressable>
                    ) : null}
                  </View>
                </>
              )}
            </View>
          ))}
        </ScrollView>

        {/* ── Voice section + input ── */}
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

          {/* Text input fallback */}
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
            />
            <Pressable
              style={[styles.sendBtn, (!inputText.trim() || processing) && styles.sendBtnDisabled]}
              onPress={() => sendTextMessage(inputText)}
              disabled={!inputText.trim() || processing}
            >
              <Ionicons name="send" size={18} color="#FFF" />
            </Pressable>
          </View>
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
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80 },
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

  /* Bubbles */
  bubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    lineHeight: 20,
  },
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 4,
  },
  bubbleTime: { fontSize: 10, fontWeight: "600", color: colors.muted },
  replayBtn: { padding: 2 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
    marginBottom: 10,
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
  listeningText: { textAlign: "center", fontSize: 12, fontWeight: "700", color: colors.primary, marginBottom: 6 },

  /* Text input */
  textInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
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
});

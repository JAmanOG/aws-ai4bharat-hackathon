/**
 * Ask Screen — voice assistant landing page.
 * Real mic recording with Sarvam STT → LLM → TTS pipeline.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Easing, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme/colors";
import * as voiceService from "../services/voice";

export default function AskScreen() {
  const nav = useNavigation<any>();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);

  /* Pulse animation */
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!recording) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  /* Request mic permission on mount */
  useEffect(() => {
    voiceService.requestMicPermission().then(setHasMicPermission);
  }, []);

  const handleMicPress = useCallback(async () => {
    if (processing) return;

    if (recording) {
      // Stop and process
      setRecording(false);
      setProcessing(true);
      setLastResponse(null);

      try {
        const uri = await voiceService.stopRecording();
        if (!uri) { setProcessing(false); return; }

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

        if (!base64) { setProcessing(false); return; }

        // Transcribe
        const transcribeRes = await fetch(
          `${require("../config/env").ENV.API_BASE_URL}/voice/transcribe`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-Id": require("../config/env").ENV.DEMO_USER_ID,
            },
            body: JSON.stringify({ audio_base64: base64, language_code: "unknown" }),
          },
        );
        const transcribeData = await transcribeRes.json();
        const transcript = transcribeData.transcript || "";

        if (!transcript.trim()) {
          setLastResponse("Could not understand audio. Please try again.");
          setProcessing(false);
          return;
        }

        // Chat
        const chatResult = await voiceService.chatWithText(transcript, {
          language_code: transcribeData.language_code || "hi",
          generate_audio: true,
        });

        setLastResponse(chatResult.response_text);

        // Play audio
        if (chatResult.audio_base64) {
          voiceService.playBase64Audio(chatResult.audio_base64).catch(() => {});
        }
      } catch (err: any) {
        setLastResponse(`Error: ${err.message || "Something went wrong"}`);
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
        setLastResponse(null);
      } catch (err: any) {
        Alert.alert("Recording Error", err.message || "Could not start recording");
      }
    }
  }, [recording, processing, hasMicPermission]);

  const openVoiceChat = () => nav.navigate("Voice");
  const openCommunity = () => nav.navigate("Community");
  const openProfile = () => nav.navigate("Profile");

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.header}>
          <Pressable style={styles.iconBtn}>
            <Ionicons name="menu" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>Assistant</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable style={styles.iconBtn} onPress={openCommunity}>
              <Ionicons name="people-outline" size={22} color={colors.ink} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={openProfile}>
              <Ionicons name="person-outline" size={22} color={colors.ink} />
            </Pressable>
          </View>
        </View>

        {/* Center */}
        <View style={styles.center}>
          <View style={styles.logoWrap}>
            <Animated.View style={[styles.ringOuter, recording && { transform: [{ scale: pulse }] }]} />
            <View style={styles.ringMid} />
            <Pressable
              style={[styles.logoCore, processing && { opacity: 0.7 }]}
              onPress={handleMicPress}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : (
                <Ionicons name={recording ? "stop" : "mic"} size={38} color={colors.primary} />
              )}
            </Pressable>
          </View>

          <Text style={styles.promptText}>
            {recording
              ? "Listening... tap to stop"
              : processing
              ? "Processing..."
              : "Namaste, how can I help you?"}
          </Text>

          {lastResponse ? (
            <View style={styles.responseCard}>
              <Text style={styles.responseText}>{lastResponse}</Text>
            </View>
          ) : (
            <Text style={styles.helper}>
              Tap the button above to speak. I can help with farming tips, market prices, weather, and government schemes.
            </Text>
          )}
        </View>

        {/* Chat button */}
        <Pressable style={styles.chatBtn} onPress={openVoiceChat}>
          <Ionicons name="chatbubbles" size={18} color="#FFF" />
          <Text style={styles.chatBtnText}>Open Full Chat</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "900", color: colors.ink },

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  logoWrap: { width: 190, height: 190, alignItems: "center", justifyContent: "center" },
  ringOuter: { position: "absolute", width: 190, height: 190, borderRadius: 95, backgroundColor: "rgba(74,144,217,0.10)" },
  ringMid: { position: "absolute", width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(74,144,217,0.18)" },
  logoCore: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(74,144,217,0.25)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },

  promptText: { marginTop: 18, fontSize: 15, fontWeight: "900", color: colors.ink, textAlign: "center" },
  helper: { marginTop: 10, fontSize: 12, fontWeight: "600", color: colors.muted, textAlign: "center", lineHeight: 18, paddingHorizontal: 20 },

  responseCard: {
    marginTop: 14,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: "100%",
  },
  responseText: { fontSize: 14, fontWeight: "600", color: colors.ink, lineHeight: 20 },

  chatBtn: {
    marginBottom: 16,
    alignSelf: "center",
    backgroundColor: colors.primary,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  chatBtnText: { fontSize: 13, fontWeight: "900", color: "#FFF", letterSpacing: 0.5 },
});

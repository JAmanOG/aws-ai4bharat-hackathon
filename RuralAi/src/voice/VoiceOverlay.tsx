/**
 * VoiceOverlay — Persistent floating voice layer that sits on TOP of every screen.
 *
 * This is the core UX hub of the voice-first interface:
 * - Compact mode (idle): floating mic pill at bottom
 * - Expanded mode (listening/processing/speaking/visualizing):
 *   Bottom sheet with waveform, transcript, AI response, visualization card
 * - Always accessible from any screen
 * - Hooks into VoiceContext for global state
 * - Uses useVoiceService for recording/playback
 * - Pipes results through VoiceContext.processResult → VoiceCommandEngine
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
  Dimensions,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { useVoice } from "./VoiceContext";
import { useVoiceService, type ChatResult } from "../services/voice";
import { VisualizationCardRenderer } from "./VoiceVisualizationCards";
import { useScreenContext } from "../context/ScreenContext";

const { height: SCREEN_H } = Dimensions.get("window");

/* ── Animated waveform bar ── */
function WaveBar({ delay, active }: { delay: number; active: boolean }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    if (!active) {
      anim.setValue(0.3);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 300 + delay,
          delay: delay * 0.3,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, delay, anim]);
  return (
    <Animated.View
      style={[
        styles.waveBar,
        {
          transform: [{ scaleY: anim }],
          backgroundColor: active ? "#FFF" : "rgba(255,255,255,0.4)",
        },
      ]}
    />
  );
}

/* ── Domain badge color ── */
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

/* ── Main component ── */

export default function VoiceOverlay({
  hidden = false,
  cleanupOnHide = true,
}: {
  hidden?: boolean;
  cleanupOnHide?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const voice = useVoiceService();
  const ctx = useVoice();
  const screenCtx = useScreenContext();
  const {
    state,
    setState,
    transcript,
    responseText,
    currentVisualization,
    lastCommand,
    ttsEnabled,
    lowDataMode,
    language,
    sessionId,
    processResult,
    clearVisualization,
    navigateRef,
  } = ctx;

  const [expanded, setExpanded] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);

  /* Animations */
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const idlePulse = useRef(new Animated.Value(1)).current;
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!hidden || !cleanupOnHide) {
      return;
    }

    if (stateRef.current === "listening") {
      voice.cancelRecording();
    }

    voice.stopPlayback();
    setState("idle");
    setExpanded(false);
    clearVisualization();
  }, [cleanupOnHide, hidden, voice, setState, clearVisualization]);

  /* Request mic permission on mount */
  useEffect(() => {
    voice.requestMicPermission().then(setHasMicPermission);
  }, []);

  /* Expand/collapse animation */
  useEffect(() => {
    Animated.spring(sheetAnim, {
      toValue: expanded ? 1 : 0,
      useNativeDriver: false,
      friction: 12,
      tension: 65,
    }).start();
  }, [expanded]);

  /* Auto-expand when voice state changes from idle */
  useEffect(() => {
    if (state !== "idle") setExpanded(true);
  }, [state]);

  /* Recording pulse animation */
  useEffect(() => {
    if (state !== "listening") {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulseAnim]);

  /* Idle gentle pulse */
  useEffect(() => {
    if (state !== "idle") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idlePulse, {
          toValue: 1.06,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(idlePulse, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state, idlePulse]);

  /* ── Recording flow ── */

  const handleMicPress = useCallback(async () => {
    if (state === "processing") return;

    if (state === "listening") {
      // Stop recording → send to pipeline
      setState("processing");
      try {
        const uri = await voice.stopRecording();
        if (!uri) {
          setState("idle");
          return;
        }
        // Read file as base64 using fetch + arrayBuffer (works in React Native / Hermes)
        const response = await fetch(uri);
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(
            ...Array.from(bytes.subarray(i, Math.min(i + chunkSize, bytes.length)))
          );
        }
        const base64 = btoa(binary);
        if (!base64) {
          setState("idle");
          return;
        }
        // Send to pipeline
        const result = await voice.chatWithAudio(base64, {
          language_code: language,
          session_id: sessionId ?? undefined,
          screen_context: screenCtx.toPromptContext(),
          generate_audio: ttsEnabled && !lowDataMode,
        });
        handleResult(result);
      } catch (err: any) {
        setState("idle");
      }
    } else {
      // Start recording
      if (hasMicPermission === false) {
        setState("idle");
        return;
      }
      try {
        clearVisualization();
        await voice.startRecording();
        setState("listening");
      } catch {
        setState("idle");
      }
    }
  }, [state, hasMicPermission, language, lowDataMode, sessionId, ttsEnabled, voice]);

  const startListening = useCallback(async () => {
    if (hasMicPermission === false) {
      setState("idle");
      return;
    }

    try {
      clearVisualization();
      await voice.startRecording();
      setState("listening");
    } catch {
      setState("idle");
    }
  }, [hasMicPermission, voice, clearVisualization, setState]);

  /* ── Shared result handler ── */

  const handleResult = useCallback(
    (result: ChatResult) => {
      // Process through VoiceContext → VoiceCommandEngine
      processResult(result);

      // Play audio if available
      if (ttsEnabled && result.audio_base64) {
        setState("speaking");
        voice
          .playBase64Audio(result.audio_base64)
          .then(() => {
            setState("visualizing");
          })
          .catch(() => setState("visualizing"));
      } else {
        setState("visualizing");
      }
    },
    [processResult, voice, setState, ttsEnabled]
  );

  /* ── Navigate callback (used by VoiceContext for auto-navigation) ── */
  // This is set by the parent via navigateRef

  /* ── Compact pill press → expand ── */
  const handlePillPress = useCallback(() => {
    if (expanded) {
      if (
        state === "idle" ||
        state === "visualizing" ||
        state === "listening"
      ) {
        handleMicPress();
      }
    } else {
      setExpanded(true);
    }
  }, [expanded, state, handleMicPress]);

  /* ── Collapse ── */
  const handleCollapse = useCallback(() => {
    if (state === "listening") {
      voice.cancelRecording();
    }
    setState("idle");
    setExpanded(false);
    clearVisualization();
  }, [state, voice]);

  /* ── Derived ── */
  const isActive = state !== "idle";
  const domainColor = DOMAIN_COLORS[lastCommand?.domain ?? "general"] ?? colors.muted;

  /* ── Sheet height interpolation ── */
  const sheetHeight = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_H * 0.55],
  });

  const sheetOpacity = sheetAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });

  if (hidden) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Backdrop when expanded */}
      {expanded && (
        <Pressable
          style={[styles.backdrop, { opacity: isActive ? 0.3 : 0.1 }]}
          onPress={handleCollapse}
        />
      )}

      {/* Expanded sheet */}
      <Animated.View
        pointerEvents={expanded ? "auto" : "none"}
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            opacity: sheetOpacity,
            paddingBottom: expanded ? insets.bottom + 80 : 0,
          },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.dragHandle}>
          <View style={styles.dragBar} />
        </View>

        {/* Status header */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: stateColor(state) }]} />
          <Text style={styles.statusText}>{stateLabel(state)}</Text>
          {lastCommand?.domain && lastCommand.domain !== "general" && (
            <View style={[styles.domainBadge, { backgroundColor: domainColor + "18" }]}>
              <Text style={[styles.domainBadgeText, { color: domainColor }]}>
                {lastCommand.domain.toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {/* Close */}
          <Pressable style={styles.iconBtn} onPress={handleCollapse}>
            <Ionicons name="chevron-down" size={18} color={colors.muted} />
          </Pressable>
        </View>

        {/* Content area */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Waveform during listening */}
          {state === "listening" && (
            <View style={styles.waveformRow}>
              {[0, 50, 100, 30, 70, 20, 80, 10, 60, 40, 90, 50].map((d, i) => (
                <WaveBar key={i} delay={d} active />
              ))}
            </View>
          )}

          {/* Transcript (user) */}
          {transcript ? (
            <View style={styles.transcriptWrap}>
              <Text style={styles.transcriptLabel}>You said:</Text>
              <Text style={styles.transcriptText}>{transcript}</Text>
            </View>
          ) : null}

          {/* AI Response */}
          {responseText ? (
            <View style={styles.responseWrap}>
              <Text style={styles.responseLabel}>
                {state === "speaking" ? "Speaking..." : "Response:"}
              </Text>
              <Text style={styles.responseText}>{responseText}</Text>
            </View>
          ) : null}

          {/* Visualization card */}
          {currentVisualization && (
            <View style={styles.vizWrap}>
              <VisualizationCardRenderer
                card={currentVisualization}
              />
            </View>
          )}

          {/* Processing spinner */}
          {state === "processing" && (
            <View style={styles.processingWrap}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.processingText}>Thinking...</Text>
            </View>
          )}

          {/* Empty state */}
          {state === "idle" && !transcript && !responseText && expanded && (
            <View style={styles.emptyState}>
              <Ionicons name="mic-outline" size={32} color={colors.muted} />
              <Text style={styles.emptyText}>Speak to control the app</Text>
              <Text style={styles.emptyHint}>
                Voice is the primary control layer. Ask naturally and the screen will respond.
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Compact floating mic pill */}
      <View
        style={[
          styles.pillWrap,
          { bottom: insets.bottom + 16 },
          expanded && { bottom: insets.bottom + 80 + SCREEN_H * 0.55 - 40 },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={handlePillPress}
          style={({ pressed }) => [
            styles.pill,
            isActive && { backgroundColor: domainColor },
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
        >
          <Animated.View
            style={[
              styles.pillPulse,
              {
                transform: [{ scale: state === "listening" ? pulseAnim : idlePulse }],
                backgroundColor:
                  state === "listening"
                    ? "rgba(239,68,68,0.2)"
                    : "rgba(74,144,217,0.15)",
              },
            ]}
          />
          {state === "processing" ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons
              name={state === "listening" ? "stop" : "mic"}
              size={24}
              color="#FFF"
            />
          )}
          {/* Status indicator */}
          {isActive && (
            <View style={styles.pillStatus}>
              <View
                style={[
                  styles.pillStatusDot,
                  { backgroundColor: stateColor(state) },
                ]}
              />
            </View>
          )}
        </Pressable>
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
      return "Listening...";
    case "processing":
      return "Processing...";
    case "speaking":
      return "Speaking...";
    case "visualizing":
      return "Result";
    default:
      return "Ready";
  }
}

/* ── Styles ── */

const PILL_SIZE = 56;
const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    pointerEvents: "box-none",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },

  /* ── Sheet ── */
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
    elevation: 20,
    overflow: "hidden",
  },
  dragHandle: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  dragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.muted,
  },
  domainBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  domainBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Content ── */
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  waveformRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    height: 40,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  waveBar: {
    width: 3,
    height: 24,
    borderRadius: 2,
  },
  transcriptWrap: {
    backgroundColor: "rgba(74,144,217,0.08)",
    borderRadius: 14,
    padding: 12,
  },
  transcriptLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.primary,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  transcriptText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 20,
  },
  responseWrap: {
    backgroundColor: colors.bg,
    borderRadius: 14,
    padding: 12,
  },
  responseLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.success,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  responseText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    lineHeight: 20,
  },
  vizWrap: {
    marginTop: 4,
  },
  processingWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  processingText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
  },
  emptyHint: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "center",
    lineHeight: 18,
  },

  /* ── Floating pill ── */
  pillWrap: {
    position: "absolute",
    right: 20,
    alignItems: "center",
  },
  pill: {
    width: PILL_SIZE,
    height: PILL_SIZE,
    borderRadius: PILL_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  pillPulse: {
    position: "absolute",
    width: PILL_SIZE + 16,
    height: PILL_SIZE + 16,
    borderRadius: (PILL_SIZE + 16) / 2,
  },
  pillStatus: {
    position: "absolute",
    top: 2,
    right: 2,
  },
  pillStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#FFF",
  },
});

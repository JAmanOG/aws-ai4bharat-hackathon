/**
 * DemoOverlay — Floating UI banner showing demo progress & controls (v2).
 *
 * Rendered on top of everything when demo mode is active.
 * Shows: step label, progress bar, category badge, Skip / Stop / Pause controls.
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDemo } from "./DemoContext";

/** Map step id prefix → domain color & icon */
function getStepMeta(stepId: string): { color: string; icon: string } {
  if (stepId.startsWith("agri"))       return { color: "#2E7D32", icon: "leaf" };
  if (stepId.startsWith("loan") || stepId.startsWith("econ"))
                                       return { color: "#6A1B9A", icon: "cash" };
  if (stepId.startsWith("knowledge"))  return { color: "#1565C0", icon: "school" };
  if (stepId.startsWith("community"))  return { color: "#5D4037", icon: "people" };
  if (stepId.startsWith("health"))     return { color: "#C62828", icon: "medkit" };
  if (stepId.startsWith("greeting"))   return { color: "#4A90D9", icon: "chatbubbles" };
  return { color: "#4A90D9", icon: "videocam" };
}

export default function DemoOverlay() {
  const insets = useSafeAreaInsets();
  const {
    isActive,
    isPaused,
    currentStepIndex,
    totalSteps,
    currentStep,
    isProcessing,
    isPlayingAudio,
    stopDemo,
    pauseDemo,
    resumeDemo,
    skipStep,
  } = useDemo();

  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Fade in/out
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isActive ? 1 : 0,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [isActive]);

  // Progress bar
  useEffect(() => {
    if (!isActive || totalSteps === 0) return;
    const progress = (currentStepIndex + 1) / totalSteps;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [currentStepIndex, totalSteps, isActive]);

  // Pulse when processing or playing
  useEffect(() => {
    if (!isProcessing && !isPlayingAudio) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isProcessing, isPlayingAudio]);

  if (!isActive) return null;

  const stepMeta = currentStep ? getStepMeta(currentStep.id) : { color: "#4A90D9", icon: "videocam" };
  const stepNum = currentStepIndex + 1;

  const statusText = isProcessing
    ? "Asking AI..."
    : isPlayingAudio
    ? "AI is speaking..."
    : isPaused
    ? "⏸ Paused"
    : currentStep?.label ?? "Demo Mode";

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top + 2, opacity: fadeAnim, transform: [{ scale: pulseAnim }] },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.banner}>
        {/* Row 1: DEMO REC badge + domain icon + step counter + close */}
        <View style={styles.topRow}>
          <View style={styles.recBadge}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>DEMO</Text>
          </View>

          <View style={[styles.domainDot, { backgroundColor: stepMeta.color + "30" }]}>
            <Ionicons name={stepMeta.icon as any} size={12} color={stepMeta.color} />
          </View>

          <Text style={styles.stepCounter}>
            Step {stepNum} of {totalSteps}
          </Text>

          <Pressable onPress={stopDemo} style={styles.stopBtn} hitSlop={12}>
            <Ionicons name="close-circle" size={24} color="#EF4444" />
          </Pressable>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: stepMeta.color,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>

        {/* Status label */}
        <View style={styles.statusRow}>
          {isProcessing ? (
            <ActivityIndicator size="small" color="#4A90D9" style={{ marginRight: 6 }} />
          ) : isPlayingAudio ? (
            <Ionicons name="volume-high" size={14} color="#22C55E" style={{ marginRight: 6 }} />
          ) : null}
          <Text style={styles.statusText} numberOfLines={2}>
            {statusText}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {isPaused ? (
            <Pressable onPress={resumeDemo} style={[styles.controlBtn, { backgroundColor: "rgba(34,197,94,0.25)" }]}>
              <Ionicons name="play" size={15} color="#22C55E" />
              <Text style={[styles.controlText, { color: "#22C55E" }]}>Resume</Text>
            </Pressable>
          ) : (
            <Pressable onPress={pauseDemo} style={styles.controlBtn}>
              <Ionicons name="pause" size={15} color="#FFF" />
              <Text style={styles.controlText}>Pause</Text>
            </Pressable>
          )}

          <Pressable onPress={skipStep} style={[styles.controlBtn, styles.skipBtn]}>
            <Ionicons name="play-skip-forward" size={15} color="#FFF" />
            <Text style={styles.controlText}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: "center",
    pointerEvents: "box-none",
  },
  banner: {
    backgroundColor: "rgba(20, 20, 38, 0.94)",
    borderRadius: 16,
    marginHorizontal: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: "92%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
    gap: 8,
  },
  recBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.18)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  recDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  recText: {
    color: "#EF4444",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  domainDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCounter: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  stopBtn: {
    padding: 2,
  },
  progressTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 7,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    minHeight: 18,
  },
  statusText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    lineHeight: 18,
  },
  controls: {
    flexDirection: "row",
    gap: 8,
  },
  controlBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 5,
  },
  skipBtn: {
    backgroundColor: "rgba(74,144,217,0.25)",
  },
  controlText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
});

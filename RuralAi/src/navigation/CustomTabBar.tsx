import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ruralPalette as P } from "../theme/ruralPalette";
import { useVoice } from "../voice/VoiceContext";
import { useVoiceService, type ChatResult } from "../services/voice";
import { useScreenContext } from "../context/ScreenContext";

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Home: ["home-outline", "home"],
  Ask: ["mic-outline", "mic"],
  Profile: ["person-outline", "person"],
};

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 8192;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(index, Math.min(index + chunkSize, bytes.length))));
  }

  return btoa(binary);
}

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const voiceService = useVoiceService();
  const screenCtx = useScreenContext();
  const {
    state: voiceState,
    setState,
    language,
    ttsEnabled,
    lowDataMode,
    sessionId,
    processResult,
    clearVisualization,
  } = useVoice();

  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const mountedRef = useRef(true);
  const isHoldRecordingRef = useRef(false);
  const isStartingRef = useRef(false);
  const pendingReleaseRef = useRef(false);
  const startedFromLongPressRef = useRef(false);
  const originScreenContextRef = useRef("");

  useEffect(() => {
    mountedRef.current = true;
    voiceService.requestMicPermission().then(setHasMicPermission).catch(() => setHasMicPermission(false));

    return () => {
      mountedRef.current = false;
      if (isHoldRecordingRef.current || isStartingRef.current) {
        voiceService.cancelRecording();
      }
    };
  }, [voiceService]);

  const pressTab = useCallback((routeName: string, routeKey: string, isFocused: boolean) => {
    const event = navigation.emit({ type: "tabPress", target: routeKey, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  }, [navigation]);

  const homeRoute = state.routes.find((route) => route.name === "Home");
  const askRoute = state.routes.find((route) => route.name === "Ask");
  const profileRoute = state.routes.find((route) => route.name === "Profile");

  if (!homeRoute || !askRoute || !profileRoute) return null;

  const buildLabel = (routeName: string, routeKey: string) =>
    descriptors[routeKey]?.options?.tabBarLabel?.toString() ?? routeName;

  const homeFocused = state.index === state.routes.findIndex((route) => route.key === homeRoute.key);
  const askFocused = state.index === state.routes.findIndex((route) => route.key === askRoute.key);
  const profileFocused = state.index === state.routes.findIndex((route) => route.key === profileRoute.key);

  const ensureMicPermission = useCallback(async () => {
    if (hasMicPermission === true) return true;
    if (hasMicPermission === false) {
      Alert.alert("Microphone permission needed", "Allow microphone access to use push-to-talk from the menu mic.");
      return false;
    }

    try {
      const granted = await voiceService.requestMicPermission();
      setHasMicPermission(granted);
      if (!granted) {
        Alert.alert("Microphone permission needed", "Allow microphone access to use push-to-talk from the menu mic.");
      }
      return granted;
    } catch {
      setHasMicPermission(false);
      Alert.alert("Microphone permission needed", "Allow microphone access to use push-to-talk from the menu mic.");
      return false;
    }
  }, [hasMicPermission, voiceService]);

  const handleResult = useCallback(async (result: ChatResult) => {
    processResult(result);

    if (!ttsEnabled || !result.audio_base64) {
      if (mountedRef.current) setState("visualizing");
      return;
    }

    if (mountedRef.current) setState("speaking");

    try {
      await voiceService.playBase64Audio(result.audio_base64);
    } finally {
      if (mountedRef.current) setState("visualizing");
    }
  }, [processResult, setState, ttsEnabled, voiceService]);

  const stopAndSendHoldRecording = useCallback(async () => {
    if (isStartingRef.current && !isHoldRecordingRef.current) {
      pendingReleaseRef.current = true;
      return;
    }

    if (!isHoldRecordingRef.current) {
      return;
    }

    isHoldRecordingRef.current = false;
    pendingReleaseRef.current = false;
    if (mountedRef.current) setState("processing");

    try {
      const uri = await voiceService.stopRecording();
      if (!uri) {
        if (mountedRef.current) setState("idle");
        return;
      }

      const response = await fetch(uri);
      const buffer = await response.arrayBuffer();
      const base64 = toBase64(new Uint8Array(buffer));
      if (!base64) {
        if (mountedRef.current) setState("idle");
        return;
      }

      const result = await voiceService.chatWithAudio(base64, {
        language_code: language,
        session_id: sessionId ?? undefined,
        screen_context: originScreenContextRef.current || screenCtx.toPromptContext(),
        generate_audio: ttsEnabled && !lowDataMode,
      });
      await handleResult(result);
    } catch {
      if (mountedRef.current) setState("idle");
    }
  }, [handleResult, language, lowDataMode, screenCtx, sessionId, setState, ttsEnabled, voiceService]);

  const startHoldRecording = useCallback(async () => {
    if (voiceState === "processing" || voiceState === "speaking" || isStartingRef.current || isHoldRecordingRef.current) {
      return;
    }

    startedFromLongPressRef.current = true;
    originScreenContextRef.current = screenCtx.toPromptContext();

    const hasPermission = await ensureMicPermission();
    if (!hasPermission) {
      startedFromLongPressRef.current = false;
      return;
    }

    clearVisualization();
    navigation.navigate(askRoute.name);

    try {
      isStartingRef.current = true;
      await voiceService.startRecording();
      isStartingRef.current = false;
      isHoldRecordingRef.current = true;
      if (mountedRef.current) setState("listening");

      if (pendingReleaseRef.current) {
        void stopAndSendHoldRecording();
      }
    } catch {
      isStartingRef.current = false;
      isHoldRecordingRef.current = false;
      pendingReleaseRef.current = false;
      if (mountedRef.current) setState("idle");
    }
  }, [
    askRoute.name,
    clearVisualization,
    ensureMicPermission,
    navigation,
    screenCtx,
    setState,
    stopAndSendHoldRecording,
    voiceService,
    voiceState,
  ]);

  const handleAskPress = useCallback(() => {
    if (startedFromLongPressRef.current) {
      startedFromLongPressRef.current = false;
      return;
    }
    pressTab(askRoute.name, askRoute.key, askFocused);
  }, [askFocused, askRoute.key, askRoute.name, pressTab]);

  const handleAskPressOut = useCallback(() => {
    if (!startedFromLongPressRef.current && !isHoldRecordingRef.current && !isStartingRef.current) {
      return;
    }
    startedFromLongPressRef.current = false;
    void stopAndSendHoldRecording();
  }, [stopAndSendHoldRecording]);

  const askActive = voiceState === "listening" || voiceState === "processing" || voiceState === "speaking";

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => pressTab(homeRoute.name, homeRoute.key, homeFocused)}
          style={({ pressed }) => [styles.sideItem, pressed && styles.pressed]}
        >
          <Ionicons
            name={(homeFocused ? ICONS.Home[1] : ICONS.Home[0]) as any}
            size={30}
            color={homeFocused ? P.goldDark : P.tabInactive}
          />
          <Text style={[styles.sideLabel, homeFocused && styles.sideLabelActive]}>
            {buildLabel(homeRoute.name, homeRoute.key)}
          </Text>
        </Pressable>

        <View style={styles.askSlot}>
          <Pressable
            delayLongPress={140}
            onPress={handleAskPress}
            onLongPress={() => {
              void startHoldRecording();
            }}
            onPressOut={handleAskPressOut}
            style={({ pressed }) => [
              styles.askButton,
              pressed && styles.askPressed,
            ]}
          >
            <View style={[styles.askRing, askActive && styles.askRingActive]}>
              <View style={[styles.askCore, voiceState === "listening" && styles.askCoreListening]}>
                {voiceState === "processing" ? (
                  <ActivityIndicator size="small" color={P.surface} />
                ) : (
                  <Ionicons
                    name={voiceState === "listening" ? "stop" : (askFocused ? ICONS.Ask[1] : ICONS.Ask[0]) as any}
                    size={34}
                    color={P.surface}
                  />
                )}
              </View>
            </View>
          </Pressable>
          <Text style={[styles.askLabel, askFocused && styles.askLabelActive]}>
            {voiceState === "listening" ? "Release" : buildLabel(askRoute.name, askRoute.key)}
          </Text>
        </View>

        <Pressable
          onPress={() => pressTab(profileRoute.name, profileRoute.key, profileFocused)}
          style={({ pressed }) => [styles.sideItem, pressed && styles.pressed]}
        >
          <Ionicons
            name={(profileFocused ? ICONS.Profile[1] : ICONS.Profile[0]) as any}
            size={30}
            color={profileFocused ? P.goldDark : P.tabInactive}
          />
          <Text style={[styles.sideLabel, profileFocused && styles.sideLabelActive]}>
            {buildLabel(profileRoute.name, profileRoute.key)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 18,
    backgroundColor: "transparent",
  },
  bar: {
    height: 106,
    borderRadius: 34,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.lineSoft,
    paddingHorizontal: 24,
    paddingTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    shadowColor: "#A79B82",
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  sideItem: {
    width: 88,
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
  },
  sideLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: P.tabInactive,
  },
  sideLabelActive: {
    color: P.goldDark,
  },
  askSlot: {
    alignItems: "center",
    marginTop: -62,
  },
  askButton: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  askPressed: {
    transform: [{ scale: 0.97 }],
  },
  askRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: P.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: P.goldShadow,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  askRingActive: {
    shadowOpacity: 0.34,
    shadowRadius: 24,
  },
  askCore: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: P.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  askCoreListening: {
    backgroundColor: "#C88D4A",
  },
  askLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: P.goldDark,
  },
  askLabelActive: {
    color: P.goldDark,
  },
  pressed: {
    opacity: 0.82,
  },
});

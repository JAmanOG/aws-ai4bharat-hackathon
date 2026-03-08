import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import { type SymptomCheckResult } from "../services/api";
import { useScreenContext } from "../context/ScreenContext";
import { useVoice } from "../voice/VoiceContext";
import { useVoiceService, type ChatResult } from "../services/voice";

const PALETTE = {
  screen: "#F7F0E2",
  paper: "#FEFCF7",
  card: "#FFFFFF",
  border: "#CCB267",
  gold: "#D8AF47",
  goldDeep: "#C79A2E",
  goldSoft: "#F2E2AE",
  ink: "#111111",
  muted: "#4A3E31",
  dim: "#786C59",
  low: "#D8AF47",
  medium: "#C68E2D",
  high: "#B54B31",
  critical: "#952A20",
  shadow: "rgba(126, 92, 31, 0.18)",
  assistantBubble: "#FFF8E7",
  userBubble: "#F0E3BD",
};

type QaTurn = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 8192;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, Math.min(i + chunkSize, bytes.length))));
  }

  return btoa(binary);
}

function buildIntroTurn(): QaTurn {
  return {
    id: `assistant-intro-${Date.now()}`,
    role: "assistant",
    text: "Namaste. I am your AI Doctor. Tell me the main symptoms first. I will then ask the age and gender before giving the health screening result.",
  };
}

function humanizeSlot(slot?: string | null) {
  switch (slot) {
    case "symptoms":
      return "Describe symptoms";
    case "age":
      return "Tell age";
    case "gender":
      return "Tell gender";
    default:
      return "Voice answer";
  }
}

function buildHeroCopy(
  voiceState: string,
  stage: string,
  missingField: string | null,
  hasResult: boolean,
) {
  if (voiceState === "listening") {
    return "Listening. Answer the AI Doctor clearly in your preferred language.";
  }
  if (voiceState === "processing") {
    return "AI Doctor is reviewing the latest answer and preparing the next step.";
  }
  if (voiceState === "speaking") {
    return "The health agent is speaking the next question or screening result.";
  }
  if (hasResult || stage === "complete") {
    return "Screening complete. Review the result below or restart the consultation for another patient.";
  }
  if (missingField) {
    return `Next step: ${humanizeSlot(missingField)}. No typing is needed on this screen.`;
  }
  return "Start by telling the symptoms. The AI Doctor will collect the rest by voice.";
}

function riskToneFromResult(result: SymptomCheckResult | null) {
  const risk = String(result?.risk_level || "").toLowerCase();
  if (risk === "critical") return PALETTE.critical;
  if (risk === "high") return PALETTE.high;
  if (risk === "medium" || risk === "moderate") return PALETTE.medium;
  return PALETTE.low;
}

export default function SymptomCheckerScreen() {
  const nav = useNavigation<any>();
  const { update: updateScreen, toPromptContext } = useScreenContext();
  const voiceService = useVoiceService();
  const {
    state,
    setState,
    language,
    ttsEnabled,
    lowDataMode,
    sessionId,
    setSessionId,
    lastCommand,
    processResult,
    clearVisualization,
  } = useVoice();

  const mountedRef = useRef(true);
  const sessionRef = useRef(
    lastCommand?.domain === "health" && lastCommand.intent?.includes("symptom") && sessionId
      ? sessionId
      : `symptom-${Date.now()}`
  );

  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [qaTurns, setQaTurns] = useState<QaTurn[]>([buildIntroTurn()]);
  const [result, setResult] = useState<SymptomCheckResult | null>(null);
  const [capturedSymptoms, setCapturedSymptoms] = useState("");
  const [capturedAge, setCapturedAge] = useState("");
  const [capturedGender, setCapturedGender] = useState("");
  const [conversationStage, setConversationStage] = useState("ready");
  const [missingField, setMissingField] = useState<string | null>("symptoms");

  const riskTone = useMemo(() => riskToneFromResult(result), [result]);
  const loading = state === "processing";
  const hasResult = !!result;
  const heroCopy = buildHeroCopy(state, conversationStage, missingField, hasResult);
  const completionCount = [capturedSymptoms, capturedAge, capturedGender].filter(Boolean).length;

  const appendTurn = useCallback((turn: QaTurn) => {
    setQaTurns((prev) => [...prev, turn].slice(-10));
  }, []);

  const resetConsultation = useCallback(() => {
    sessionRef.current = `symptom-${Date.now()}`;
    setSessionId(sessionRef.current);
    setQaTurns([buildIntroTurn()]);
    setResult(null);
    setCapturedSymptoms("");
    setCapturedAge("");
    setCapturedGender("");
    setConversationStage("ready");
    setMissingField("symptoms");
    clearVisualization();
    setState("idle");
    voiceService.cancelRecording().catch(() => {});
    voiceService.stopPlayback().catch(() => {});
  }, [clearVisualization, setSessionId, setState, voiceService]);

  useEffect(() => {
    mountedRef.current = true;
    setSessionId(sessionRef.current);
    voiceService.requestMicPermission().then(setHasMicPermission).catch(() => setHasMicPermission(false));

    return () => {
      mountedRef.current = false;
      voiceService.cancelRecording().catch(() => {});
      voiceService.stopPlayback().catch(() => {});
      setState("idle");
    };
  }, []);

  useEffect(() => {
    updateScreen({
      screen: "SymptomChecker",
      tab: hasResult ? "results" : "consultation",
      meta: {
        availableActions: "Start voice consultation, answer AI Doctor, restart consultation",
        consultationMode: "voice_only",
        conversationStage,
        missingField: missingField ? humanizeSlot(missingField) : "None",
        capturedSymptoms: capturedSymptoms || "None",
        capturedAge: capturedAge || "None",
        capturedGender: capturedGender || "None",
        turnCount: qaTurns.length,
        resultReady: hasResult ? "Yes" : "No",
        riskLevel: result?.risk_level || "None",
        urgency: result?.urgency || "None",
        possibleConditions: (result?.possible_conditions || []).join(", ") || "None",
      },
    });
  }, [
    capturedAge,
    capturedGender,
    capturedSymptoms,
    conversationStage,
    hasResult,
    missingField,
    qaTurns.length,
    result,
    updateScreen,
  ]);

  const handleResult = useCallback(
    async (chatResult: ChatResult) => {
      processResult(chatResult);

      if (chatResult.transcript) {
        appendTurn({
          id: `user-${Date.now()}`,
          role: "user",
          text: chatResult.transcript,
        });
      }

      appendTurn({
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: chatResult.response_text,
      });

      const metadata = (chatResult.metadata ?? {}) as {
        symptomIntake?: { symptoms?: string; age?: string | number; gender?: string };
        triage_result?: SymptomCheckResult;
        conversationStage?: string;
        followUp?: { pendingSlot?: string };
      };

      const intake = metadata.symptomIntake;
      if (intake?.symptoms) setCapturedSymptoms(String(intake.symptoms));
      if (intake?.age != null) setCapturedAge(String(intake.age));
      if (intake?.gender) setCapturedGender(String(intake.gender));

      if (metadata.followUp?.pendingSlot) {
        setMissingField(metadata.followUp.pendingSlot);
      } else {
        setMissingField(null);
      }

      if (metadata.conversationStage) {
        setConversationStage(metadata.conversationStage);
      } else if (metadata.triage_result) {
        setConversationStage("complete");
      } else {
        setConversationStage("collecting");
      }

      if (metadata.triage_result) {
        setResult(metadata.triage_result);
      }

      if (!ttsEnabled || !chatResult.audio_base64) {
        if (mountedRef.current) setState("visualizing");
        return;
      }

      if (mountedRef.current) setState("speaking");

      try {
        await voiceService.playBase64Audio(chatResult.audio_base64);
      } finally {
        if (mountedRef.current) setState("visualizing");
      }
    },
    [appendTurn, processResult, setState, ttsEnabled, voiceService],
  );

  const startListening = useCallback(async () => {
    if (hasMicPermission === false) {
      Alert.alert("Microphone permission needed", "Allow microphone access to speak with the AI Doctor.");
      return;
    }

    try {
      clearVisualization();
      setConversationStage((current) => (current === "complete" ? "collecting" : current));
      await voiceService.startRecording();
      if (mountedRef.current) setState("listening");
    } catch {
      if (mountedRef.current) setState("idle");
    }
  }, [clearVisualization, hasMicPermission, setState, voiceService]);

  const stopAndSend = useCallback(async () => {
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

      const chatResult = await voiceService.chatWithAudio(base64, {
        language_code: language,
        session_id: sessionId ?? sessionRef.current,
        screen_context: toPromptContext(),
        generate_audio: ttsEnabled && !lowDataMode,
      });
      await handleResult(chatResult);
    } catch (error: any) {
      Alert.alert("Unable to continue", error?.message ?? "Please try speaking again.");
      if (mountedRef.current) setState("idle");
      setConversationStage("error");
    }
  }, [handleResult, language, lowDataMode, sessionId, setState, toPromptContext, ttsEnabled, voiceService]);

  const handleMicPress = useCallback(async () => {
    if (state === "processing" || state === "speaking") return;
    if (state === "listening") {
      await stopAndSend();
      return;
    }
    await startListening();
  }, [startListening, state, stopAndSend]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate("HomeMain"))}
          >
            <Ionicons name="chevron-back" size={28} color={PALETTE.ink} />
          </Pressable>
          <Text style={styles.title}>Symptom Checker</Text>
        </View>

        <Text style={styles.eyebrow}>AI DOCTOR CONSULTATION</Text>

        <Pressable style={[styles.micButton, state === "listening" && styles.micButtonActive]} onPress={handleMicPress}>
          {loading ? (
            <ActivityIndicator size="small" color={PALETTE.card} />
          ) : (
            <Ionicons name={state === "listening" ? "stop" : "mic"} size={54} color={PALETTE.card} />
          )}
        </Pressable>

        <Text style={styles.heroCopy}>{heroCopy}</Text>

        <View style={styles.visualRow}>
          <View style={styles.waveCard}>
            <GoldWave loading={loading} />
          </View>

          <View style={styles.summaryColumn}>
            <SummaryTile
              title="Collected"
              loading={false}
              value={`${completionCount}/3 details`}
            />
            <SummaryTile
              title="Next Step"
              loading={loading}
              value={missingField ? humanizeSlot(missingField) : hasResult ? "Review result" : "Start speaking"}
            />
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: hasResult ? "100%" : `${Math.max(26, completionCount * 28)}%`,
              },
            ]}
          />
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusPillRow}>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>Symptoms: {capturedSymptoms || "Waiting"}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>Age: {capturedAge || "Waiting"}</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>Gender: {capturedGender || "Waiting"}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>AI Doctor vs Patient</Text>
          <View style={styles.conversationStack}>
            {qaTurns.map((turn) => (
              <View
                key={turn.id}
                style={[
                  styles.turnBubble,
                  turn.role === "assistant" ? styles.assistantBubble : styles.userBubble,
                ]}
              >
                <Text style={styles.turnRole}>{turn.role === "assistant" ? "AI Doctor" : "Patient"}</Text>
                <Text style={styles.turnText}>{turn.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable style={styles.secondaryButton} onPress={resetConsultation}>
          <Ionicons name="refresh" size={16} color={PALETTE.ink} />
          <Text style={styles.secondaryButtonText}>Restart consultation</Text>
        </Pressable>

        {result ? (
          <View style={styles.resultCard}>
            <View style={styles.resultTopRow}>
              <View style={[styles.riskBadge, { backgroundColor: riskTone }]}>
                <Text style={styles.riskBadgeText}>{String(result.risk_level || "low").toUpperCase()} RISK</Text>
              </View>
              <Text style={styles.urgencyText}>
                Urgency: <Text style={styles.urgencyValue}>{String(result.urgency || "routine")}</Text>
              </Text>
            </View>

            <ResultSection title="Possible Conditions">
              {(result.possible_conditions || []).map((condition, index) => (
                <BulletItem key={`${condition}-${index}`} icon="ellipse" text={condition} />
              ))}
            </ResultSection>

            <ResultSection title="Recommended Action">
              <Text style={styles.resultBody}>{result.recommended_action}</Text>
            </ResultSection>

            <ResultSection title="Home Remedies">
              {(result.home_remedies || []).length > 0 ? (
                (result.home_remedies || []).map((remedy, index) => (
                  <BulletItem key={`${remedy}-${index}`} icon="leaf" text={remedy} />
                ))
              ) : (
                <Text style={styles.resultBody}>No home remedies were returned for this risk level.</Text>
              )}
            </ResultSection>

            <ResultSection title="Warning Signs">
              {(result.warning_signs || []).map((warning, index) => (
                <BulletItem key={`${warning}-${index}`} icon="warning" text={warning} warning />
              ))}
            </ResultSection>
          </View>
        ) : null}

        <Text style={styles.disclaimer}>
          Disclaimer: This is AI-assisted symptom screening only. It is not a confirmed diagnosis. For urgent symptoms, contact a certified healthcare professional, nearby PHC, or emergency services immediately.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function GoldWave({ loading }: { loading: boolean }) {
  return (
    <Svg width="100%" height={150} viewBox="0 0 420 150">
      <Defs>
        <LinearGradient id="wave" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#D0A43A" />
          <Stop offset="50%" stopColor="#E4C66B" />
          <Stop offset="100%" stopColor="#C89A34" />
        </LinearGradient>
        <LinearGradient id="glow" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#EAD89A" stopOpacity="0.7" />
          <Stop offset="100%" stopColor="#EAD89A" stopOpacity="0.12" />
        </LinearGradient>
      </Defs>

      <Circle cx="80" cy="74" r="22" fill="url(#glow)" />
      <Circle cx="160" cy="80" r="34" fill="url(#glow)" />
      <Circle cx="238" cy="62" r="26" fill="url(#glow)" />
      <Circle cx="322" cy="84" r="30" fill="url(#glow)" />

      <Path
        d="M 12 84 C 36 84, 40 54, 68 72 C 90 86, 96 118, 120 102 C 136 92, 142 70, 158 78 C 174 86, 178 120, 196 118 C 220 116, 226 22, 248 22 C 266 22, 274 110, 296 110 C 314 110, 326 72, 344 72 C 360 72, 366 96, 386 96 C 400 96, 408 84, 420 84"
        stroke="url(#wave)"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Rect
        x="0"
        y="136"
        width="420"
        height="10"
        rx="5"
        fill="#EBDDB5"
      />
      <Rect
        x="0"
        y="136"
        width={loading ? 244 : 160}
        height="10"
        rx="5"
        fill="url(#wave)"
      />
    </Svg>
  );
}

function SummaryTile({
  title,
  loading,
  value,
}: {
  title: string;
  loading: boolean;
  value: string;
}) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryTitle}>{title}</Text>
      <View style={styles.summaryBody}>
        {loading ? (
          <ActivityIndicator size="small" color={PALETTE.goldDeep} />
        ) : (
          <Text style={styles.summaryValue}>{value}</Text>
        )}
      </View>
    </View>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.resultSection}>
      <Text style={styles.resultHeading}>{title}</Text>
      <View style={styles.resultSectionBody}>{children}</View>
    </View>
  );
}

function BulletItem({
  icon,
  text,
  warning = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  warning?: boolean;
}) {
  return (
    <View style={styles.bulletRow}>
      <Ionicons name={icon} size={16} color={warning ? PALETTE.medium : PALETTE.goldDeep} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PALETTE.screen,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  eyebrow: {
    marginTop: 22,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "900",
    color: PALETTE.ink,
    letterSpacing: 0.6,
  },
  micButton: {
    width: 138,
    height: 138,
    borderRadius: 69,
    alignSelf: "center",
    marginTop: 28,
    backgroundColor: PALETTE.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PALETTE.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  micButtonActive: {
    backgroundColor: PALETTE.goldDeep,
  },
  heroCopy: {
    marginTop: 26,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
    color: PALETTE.muted,
    paddingHorizontal: 18,
  },
  visualRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 22,
    alignItems: "flex-end",
  },
  waveCard: {
    flex: 1,
    minHeight: 160,
    justifyContent: "flex-end",
  },
  summaryColumn: {
    width: 112,
    gap: 10,
  },
  summaryTile: {
    backgroundColor: PALETTE.card,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: PALETTE.border,
    padding: 10,
    minHeight: 98,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: PALETTE.ink,
    lineHeight: 16,
  },
  summaryBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    color: PALETTE.dim,
    fontWeight: "700",
  },
  progressTrack: {
    marginTop: 6,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#EADDB9",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: PALETTE.gold,
  },
  statusCard: {
    marginTop: 18,
    backgroundColor: PALETTE.paper,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E4D7B6",
    padding: 16,
  },
  statusPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F1E4BC",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: PALETTE.muted,
  },
  sectionTitle: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  conversationStack: {
    marginTop: 12,
    gap: 10,
  },
  turnBubble: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E0D2AD",
  },
  assistantBubble: {
    backgroundColor: PALETTE.assistantBubble,
    marginRight: 28,
  },
  userBubble: {
    backgroundColor: PALETTE.userBubble,
    marginLeft: 28,
  },
  turnRole: {
    fontSize: 11,
    fontWeight: "900",
    color: PALETTE.dim,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  turnText: {
    fontSize: 15,
    lineHeight: 22,
    color: PALETTE.muted,
  },
  secondaryButton: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: PALETTE.ink,
  },
  resultCard: {
    marginTop: 20,
    backgroundColor: PALETTE.card,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: PALETTE.border,
    padding: 18,
  },
  resultTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  riskBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: PALETTE.card,
  },
  urgencyText: {
    fontSize: 16,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  urgencyValue: {
    fontWeight: "500",
  },
  resultSection: {
    marginTop: 14,
  },
  resultHeading: {
    fontSize: 17,
    fontWeight: "900",
    color: PALETTE.ink,
    marginBottom: 6,
  },
  resultSectionBody: {
    gap: 6,
  },
  resultBody: {
    fontSize: 15,
    lineHeight: 22,
    color: PALETTE.muted,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: PALETTE.muted,
  },
  disclaimer: {
    marginTop: 20,
    fontSize: 13,
    lineHeight: 20,
    color: PALETTE.muted,
  },
});

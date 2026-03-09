import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useVoice } from "../voice/VoiceContext";
import { useVoiceService, type ChatResult } from "../services/voice";
import { VisualizationCardRenderer } from "../voice/VoiceVisualizationCards";
import { useScreenContext } from "../context/ScreenContext";
import { APP_LOGO, APP_NAME_UPPER } from "../theme/brand";
import {
  healthApi,
  visionApi,
  type HealthImagingType,
  type VisionAttachmentAnalysis,
} from "../services/api";
import { askDomains, ruralPalette as P } from "../theme/ruralPalette";
const HERO_SIZE = 120;

type AskAttachmentMimeType = "application/pdf" | "image/jpeg" | "image/png";
type AskAttachmentSource = "camera" | "document";
type AskAttachmentCategory = "medical_report" | "crop_image" | "general_image";
type AskAttachmentStatus = "selected" | "analyzing" | "ready" | "error";

type PickedAttachment = {
  uri: string;
  name: string;
  mimeType: AskAttachmentMimeType;
  source: AskAttachmentSource;
  size?: number;
};

type AskAttachment = PickedAttachment & {
  id: string;
  status: AskAttachmentStatus;
  category: AskAttachmentCategory;
  analysisTitle?: string;
  analysisSummary?: string;
  observations?: string[];
  promptHint?: string;
  suggestedDomain?: "agriculture" | "health" | "general";
  suggestedIntent?: string;
  confidence?: number;
  documentId?: string;
  imagingType?: HealthImagingType;
  error?: string;
};

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 8192;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, Math.min(i + chunkSize, bytes.length))));
  }

  return btoa(binary);
}

function normalizeMimeType(name: string, mimeType?: string | null): AskAttachmentMimeType | null {
  const raw = String(mimeType || "").toLowerCase();
  if (raw === "application/pdf") return "application/pdf";
  if (raw === "image/png") return "image/png";
  if (raw === "image/jpeg" || raw === "image/jpg") return "image/jpeg";

  const lowerName = String(name || "").toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  return null;
}

function inferHealthImagingType(name: string): HealthImagingType {
  const lower = String(name || "").toLowerCase();
  if (/x[\s-]?ray/.test(lower)) return "xray";
  if (/\bmri\b/.test(lower)) return "mri";
  if (/\bct\b|ct[\s-]?scan/.test(lower)) return "ct_scan";
  if (/ultra[\s-]?sound|sonography/.test(lower)) return "ultrasound";
  return "pathology";
}

function looksLikeMedicalDocument(name: string) {
  return /report|lab|blood|scan|x[\s-]?ray|\bmri\b|\bct\b|ultra[\s-]?sound|prescription|discharge|medical|test/i.test(String(name || ""));
}

function sanitizeContextValue(value?: string | null, limit = 220) {
  return String(value || "")
    .replace(/[.:]/g, ",")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function attachmentCategoryLabel(category: AskAttachmentCategory) {
  if (category === "medical_report") return "Medical";
  if (category === "crop_image") return "Crop";
  return "Image";
}

function mapVisionKindToCategory(kind?: VisionAttachmentAnalysis["attachmentKind"]): AskAttachmentCategory {
  if (kind === "crop_image" || kind === "field_image") return "crop_image";
  if (kind === "medical_image" || kind === "medical_document") return "medical_report";
  return "general_image";
}

function buildAttachmentHint(attachment?: AskAttachment | null) {
  if (!attachment) {
    return "Take a photo or choose a report, then ask about it.";
  }
  if (attachment.promptHint) return attachment.promptHint;
  if (attachment.category === "medical_report") {
    return "Ask what this report means or what to discuss with a doctor.";
  }
  if (attachment.category === "crop_image") {
    return "Ask what issue is visible in this crop and what action to take next.";
  }
  return "Ask what this image shows or what you want to know about it.";
}

function buildAttachmentPromptContext(attachment?: AskAttachment | null) {
  if (!attachment) return "";

  const parts = [
    `Selected attachment name: ${sanitizeContextValue(attachment.name, 80) || "unknown"}`,
    `Selected attachment type: ${attachmentCategoryLabel(attachment.category)}`,
    `Selected attachment status: ${attachment.status}`,
  ];

  if (attachment.suggestedDomain) {
    parts.push(`Attachment suggested domain: ${attachment.suggestedDomain}`);
  }
  if (attachment.analysisSummary) {
    parts.push(`Attachment summary: ${sanitizeContextValue(attachment.analysisSummary)}`);
  }
  if (attachment.observations?.length) {
    parts.push(`Attachment observations: ${sanitizeContextValue(attachment.observations.join(", "), 180)}`);
  }
  if (attachment.promptHint) {
    parts.push(`Attachment prompt hint: ${sanitizeContextValue(attachment.promptHint, 150)}`);
  }
  if (attachment.documentId) {
    parts.push(`Attachment document id: ${attachment.documentId}`);
  }
  return parts.join(". ");
}

function attachmentIconName(attachment: AskAttachment): keyof typeof Ionicons.glyphMap {
  if (attachment.status === "error") return "alert-circle";
  if (attachment.category === "medical_report") return "document-text";
  if (attachment.category === "crop_image") return "leaf";
  return "images";
}

function statusCopy(state: string, hasResult: boolean, attachment?: AskAttachment | null) {
  const attachmentHint = buildAttachmentHint(attachment);

  switch (state) {
    case "listening":
      return {
        title: "Release to Send",
        subtitle: attachment
          ? "Keep holding while you ask about this photo or report, then release."
          : "Keep holding while you speak in Hindi, English, or your preferred language.",
      };
    case "processing":
      return {
        title: "Thinking...",
        subtitle: attachment
          ? "The assistant is combining your voice query with the selected attachment."
          : "The assistant is grounding your answer with app context and live tools.",
      };
    case "speaking":
      return {
        title: "Speaking",
        subtitle: "The response is being read aloud.",
      };
    case "visualizing":
      return {
        title: "Response Ready",
        subtitle: hasResult
          ? "The latest answer is visible below. Hold again when you want to ask the next question."
          : "Hold again when you want to continue.",
      };
    default:
      return {
        title: "Hold to Speak",
        subtitle: attachment ? attachmentHint : "Example: Hold and ask about crop prices in Hindi...",
      };
  }
}

function DomainBubble({
  label,
  icon,
  bubble,
  iconColor,
  style,
  counterRotate,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  bubble: string;
  iconColor: string;
  style?: any;
  counterRotate?: Animated.AnimatedInterpolation<string>;
}) {
  const inner = (
    <>
      <View style={[styles.domainCircle, { backgroundColor: bubble }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={styles.domainLabel}>{label}</Text>
    </>
  );

  return (
    <View style={[styles.domainNode, style]}>
      {counterRotate ? (
        <Animated.View style={{ alignItems: "center", transform: [{ rotate: counterRotate }] }}>
          {inner}
        </Animated.View>
      ) : (
        <View style={{ alignItems: "center" }}>{inner}</View>
      )}
    </View>
  );
}

export default function AskScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const voiceService = useVoiceService();
  const screen = useScreenContext();
  const {
    state,
    setState,
    transcript,
    responseText,
    currentVisualization,
    lastCommand,
    language,
    ttsEnabled,
    lowDataMode,
    sessionId,
    processResult,
    clearVisualization,
  } = useVoice();

  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<AskAttachment | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const halo = useRef(new Animated.Value(0.9)).current;
  const orbitSpin = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(true);
  const attachmentJobRef = useRef(0);
  const isHoldRecordingRef = useRef(false);
  const isStartingRef = useRef(false);
  const pendingReleaseRef = useRef(false);

  const hasResult = !!(transcript || responseText || currentVisualization);
  const attachmentPromptContext = useMemo(
    () => buildAttachmentPromptContext(selectedAttachment),
    [selectedAttachment]
  );
  const copy = statusCopy(state, hasResult, selectedAttachment);
  const activeDomain = lastCommand?.domain ?? "general";
  const orbitRotate = useMemo(
    () =>
      orbitSpin.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
      }),
    [orbitSpin]
  );

  const counterRotate = useMemo(
    () =>
      orbitSpin.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "-360deg"],
      }),
    [orbitSpin]
  );

  const navigateForHealthResult = useCallback((result: ChatResult) => {
    if (result.domain !== "health") return;

    const intent = String(result.intent || "");
    if (intent.includes("symptom")) {
      nav.navigate("Home", { screen: "SymptomChecker" });
      return;
    }

    if (
      intent.includes("medical_report")
      || intent.includes("health_platform_help")
      || intent.includes("health_scheme")
      || intent.includes("facility_referral")
    ) {
      nav.navigate("Home", { screen: "HealthDashboard" });
    }
  }, [nav]);

  useEffect(() => {
    mountedRef.current = true;
    voiceService.requestMicPermission().then(setHasMicPermission).catch(() => setHasMicPermission(false));

    return () => {
      mountedRef.current = false;
      voiceService.cancelRecording();
      voiceService.stopPlayback();
      isHoldRecordingRef.current = false;
      isStartingRef.current = false;
      pendingReleaseRef.current = false;
      setState("idle");
    };
  }, []);

  useEffect(() => {
    screen.update({
      screen: "Ask",
      meta: {
        voiceState: state,
        visibleDomains: askDomains.map((domain) => domain.label).join(", "),
        activeDomain,
        transcriptVisible: !!transcript,
        responseVisible: !!responseText,
        selectedAttachmentName: sanitizeContextValue(selectedAttachment?.name || "None", 80),
        selectedAttachmentType: selectedAttachment ? attachmentCategoryLabel(selectedAttachment.category) : "None",
        selectedAttachmentStatus: selectedAttachment?.status || "none",
        attachmentSummary: sanitizeContextValue(selectedAttachment?.analysisSummary || selectedAttachment?.error || "None"),
        attachmentObservations: sanitizeContextValue(selectedAttachment?.observations?.join(", ") || "None", 180),
        attachmentPromptHint: selectedAttachment
          ? sanitizeContextValue(buildAttachmentHint(selectedAttachment), 150)
          : "None",
      },
    });
  }, [activeDomain, attachmentPromptContext, responseText, screen.update, selectedAttachment, state, transcript]);

  useEffect(() => {
    if (state !== "listening") {
      pulse.setValue(1);
      halo.setValue(0.9);
      return;
    }

    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.06,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(halo, {
            toValue: 1.12,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(halo, {
            toValue: 0.9,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [halo, pulse, state]);

  useEffect(() => {
    if (hasResult) {
      orbitSpin.stopAnimation();
      orbitSpin.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(orbitSpin, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    loop.start();
    return () => {
      loop.stop();
      orbitSpin.setValue(0);
    };
  }, [hasResult, orbitSpin]);

  const buildVoiceScreenContext = useCallback(() => {
    const baseContext = screen.toPromptContext();
    if (!attachmentPromptContext) {
      return baseContext;
    }
    return `${baseContext}. ${attachmentPromptContext}`;
  }, [attachmentPromptContext, screen]);

  const analyzeMedicalDocument = useCallback(async (asset: PickedAttachment) => {
    const imagingType = inferHealthImagingType(asset.name);
    const upload = await healthApi.initiateUpload({
      fileName: asset.name,
      fileType: asset.mimeType,
      imagingType,
      metadata: {
        description: `Ask attachment upload for ${asset.name}`,
        originalName: asset.name,
        source: asset.source,
      },
    });

    const localFile = await fetch(asset.uri);
    const fileBuffer = await localFile.arrayBuffer();
    const uploadResponse = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": asset.mimeType },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed with status ${uploadResponse.status}`);
    }

    const analysis = await healthApi.analyzeImage(upload.documentId, imagingType);
    const summary = analysis.analysis.general_info || analysis.analysis.next_steps || "Medical report insights are ready.";
    const observations = Array.isArray(analysis.analysis.common_findings)
      ? analysis.analysis.common_findings.filter(Boolean).slice(0, 3)
      : [];

    return {
      category: "medical_report" as const,
      analysisTitle: "Medical Report Ready",
      analysisSummary: summary,
      observations,
      promptHint: "Ask what this report means, what the important findings are, or what to discuss with a doctor.",
      suggestedDomain: "health" as const,
      suggestedIntent: "medical_report_analysis",
      documentId: upload.documentId,
      imagingType,
    };
  }, []);

  const analyzeImageAttachment = useCallback(async (asset: PickedAttachment & { mimeType: "image/jpeg" | "image/png" }) => {
    const response = await fetch(asset.uri);
    const buffer = await response.arrayBuffer();
    const base64 = toBase64(new Uint8Array(buffer));

    if (!base64) {
      throw new Error("Unable to read the selected image.");
    }

    const analysis = await visionApi.analyzeAttachment({
      fileBase64: base64,
      fileType: asset.mimeType,
      fileName: asset.name,
      source: asset.source,
    });

    return {
      category: mapVisionKindToCategory(analysis.attachmentKind),
      analysisTitle: analysis.title,
      analysisSummary: analysis.summary,
      observations: analysis.keyObservations,
      promptHint: analysis.spokenPromptHint || buildAttachmentHint(null),
      suggestedDomain: analysis.suggestedDomain,
      suggestedIntent: analysis.suggestedIntent,
      confidence: analysis.confidence,
    };
  }, []);

  const prepareAttachment = useCallback(async (asset: PickedAttachment) => {
    if (asset.mimeType !== "application/pdf" && asset.size && asset.size > 6 * 1024 * 1024) {
      Alert.alert("Image too large", "Choose an image under 6MB so it can be analyzed quickly.");
      return;
    }

    clearVisualization();
    const draft: AskAttachment = {
      id: `${Date.now()}-${asset.name}`,
      ...asset,
      category: asset.mimeType === "application/pdf" ? "medical_report" : "general_image",
      status: "analyzing",
    };

    const jobId = attachmentJobRef.current + 1;
    attachmentJobRef.current = jobId;
    setSelectedAttachment(draft);

    try {
      const analysis = asset.mimeType === "application/pdf"
        ? await analyzeMedicalDocument(asset)
        : await analyzeImageAttachment(asset as PickedAttachment & { mimeType: "image/jpeg" | "image/png" });

      if (attachmentJobRef.current !== jobId) {
        return;
      }

      setSelectedAttachment({
        ...draft,
        ...analysis,
        category: analysis.category,
        status: "ready",
      });
    } catch (error: any) {
      if (attachmentJobRef.current !== jobId) {
        return;
      }

      setSelectedAttachment({
        ...draft,
        status: "error",
        error: error?.message ?? "Unable to analyze the selected attachment right now.",
      });
      Alert.alert("Attachment analysis failed", error?.message ?? "Unable to analyze the selected attachment right now.");
    }
  }, [analyzeImageAttachment, analyzeMedicalDocument, clearVisualization]);

  const pickAttachmentFromCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera permission needed", "Allow camera access to capture a photo for AI analysis.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    const mimeType = normalizeMimeType(asset.fileName || "", asset.mimeType);
    if (!mimeType || mimeType === "application/pdf") {
      Alert.alert("Unsupported file", "Capture a JPG or PNG image.");
      return;
    }

    await prepareAttachment({
      uri: asset.uri,
      name: asset.fileName || `camera-photo-${Date.now()}.jpg`,
      mimeType,
      source: "camera",
      size: asset.fileSize,
    });
  }, [prepareAttachment]);

  const pickAttachmentFromFiles = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ["application/pdf", "image/jpeg", "image/png"],
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    const mimeType = normalizeMimeType(asset.name || "", asset.mimeType);
    if (!mimeType) {
      Alert.alert("Unsupported file", "Choose a PDF, JPG, or PNG file.");
      return;
    }

    if (mimeType === "application/pdf" && !looksLikeMedicalDocument(asset.name || "")) {
      Alert.alert("PDF support is limited", "For now, PDF upload on Ask is for medical reports only. Use an image for crop or object questions.");
      return;
    }

    await prepareAttachment({
      uri: asset.uri,
      name: asset.name || `attachment-${Date.now()}`,
      mimeType,
      source: "document",
      size: asset.size,
    });
  }, [prepareAttachment]);

  const openAttachmentPicker = useCallback(() => {
    if (state === "listening" || state === "processing" || state === "speaking") {
      Alert.alert("Finish the current turn", "Stop the current voice turn before adding a new photo or report.");
      return;
    }

    if (selectedAttachment?.status === "analyzing") {
      Alert.alert("Attachment is still processing", "Wait for the current photo or report to finish analyzing.");
      return;
    }

    Alert.alert(
      "Add photo or report",
      "Take a photo or choose an image/report file, then ask about it.",
      [
        {
          text: "Take Photo",
          onPress: () => {
            void pickAttachmentFromCamera();
          },
        },
        {
          text: "Choose File",
          onPress: () => {
            void pickAttachmentFromFiles();
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }, [pickAttachmentFromCamera, pickAttachmentFromFiles, selectedAttachment?.status, state]);

  const clearAttachmentSelection = useCallback(() => {
    if (selectedAttachment?.status === "analyzing") {
      return;
    }
    attachmentJobRef.current += 1;
    setSelectedAttachment(null);
  }, [selectedAttachment?.status]);

  const handleResult = useCallback(
    (result: ChatResult) => {
      processResult(result);
      navigateForHealthResult(result);

      if (!ttsEnabled || !result.audio_base64) {
        if (mountedRef.current) setState("visualizing");
        return;
      }

      if (mountedRef.current) setState("speaking");

      voiceService
        .playBase64Audio(result.audio_base64)
        .then(() => {
          if (mountedRef.current) setState("visualizing");
        })
        .catch(() => {
          if (mountedRef.current) setState("visualizing");
        });
    },
    [navigateForHealthResult, processResult, setState, ttsEnabled, voiceService]
  );

  const stopAndSend = useCallback(async () => {
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
        screen_context: buildVoiceScreenContext(),
        generate_audio: ttsEnabled && !lowDataMode,
      });
      handleResult(result);
    } catch {
      isStartingRef.current = false;
      pendingReleaseRef.current = false;
      if (mountedRef.current) setState("idle");
    }
  }, [buildVoiceScreenContext, handleResult, language, lowDataMode, sessionId, setState, ttsEnabled, voiceService]);

  const startHoldRecording = useCallback(async () => {
    if (state === "processing" || state === "speaking" || isStartingRef.current || isHoldRecordingRef.current) {
      return;
    }

    isStartingRef.current = true;
    pendingReleaseRef.current = false;

    if (hasMicPermission === false) {
      isStartingRef.current = false;
      Alert.alert("Microphone permission needed", "Allow microphone access to speak with the assistant.");
      return;
    }

    if (selectedAttachment?.status === "analyzing") {
      isStartingRef.current = false;
      Alert.alert("Attachment is still processing", "Wait for the selected photo or report to finish analyzing.");
      return;
    }

    try {
      clearVisualization();
      await voiceService.startRecording();
      isStartingRef.current = false;
      isHoldRecordingRef.current = true;
      if (mountedRef.current) {
        setState("listening");
      }

      if (pendingReleaseRef.current) {
        void stopAndSend();
      }
    } catch {
      isStartingRef.current = false;
      isHoldRecordingRef.current = false;
      pendingReleaseRef.current = false;
      if (mountedRef.current) setState("idle");
    }
  }, [clearVisualization, hasMicPermission, selectedAttachment?.status, setState, state, stopAndSend, voiceService]);

  const handleHeroPressOut = useCallback(() => {
    if (!isHoldRecordingRef.current && !isStartingRef.current) {
      return;
    }

    void stopAndSend();
  }, [stopAndSend]);

  const openAlerts = useCallback(() => {
    nav.navigate("Home", { screen: "Alerts" });
  }, [nav]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.topRow}>
          <View style={styles.brandLockup}>
            <Image source={APP_LOGO} style={styles.brandLogo} resizeMode="contain" />
            <Text style={styles.brand}>{APP_NAME_UPPER}</Text>
          </View>
          <Pressable style={styles.topIconBtn} onPress={openAlerts}>
            <Ionicons name="notifications" size={24} color={P.mutedDark} />
          </Pressable>
        </View>

        <Text style={styles.hindiHeading}>मेरी फसल के लिए सलाह</Text>

        <View style={styles.heroSection}>
          <View style={styles.sideDotsLeft}>
            {[0, 1, 2].map((idx) => (
              <View key={`l-${idx}`} style={[styles.sideDot, idx === 1 && styles.sideDotCenter]} />
            ))}
          </View>
          <View style={styles.sideDotsRight}>
            {[0, 1, 2].map((idx) => (
              <View key={`r-${idx}`} style={[styles.sideDot, idx === 1 && styles.sideDotCenter]} />
            ))}
          </View>

          <Animated.View style={[styles.heroHalo, { transform: [{ scale: halo }] }]} />
          <View style={styles.heroRing}>
            <Animated.View style={{ transform: [{ scale: pulse }] }}>
              <Pressable
                delayLongPress={140}
                onLongPress={() => {
                  void startHoldRecording();
                }}
                onPressOut={handleHeroPressOut}
                style={({ pressed }) => [
                  styles.heroButton,
                  state === "listening" && styles.heroButtonActive,
                  pressed && styles.heroButtonPressed,
                ]}
              >
                {state === "processing" ? (
                  <ActivityIndicator size="small" color={P.surface} />
                ) : (
                  <Ionicons name="mic" size={54} color={P.surface} />
                )}
              </Pressable>
            </Animated.View>
          </View>
        </View>

        <Text style={styles.heroTitle}>{copy.title}</Text>
        <Text style={styles.heroSubtitle}>{copy.subtitle}</Text>

        {selectedAttachment ? (
          <View style={styles.attachmentCard}>
            <View style={styles.attachmentHeader}>
              <View style={styles.attachmentIconWrap}>
                {selectedAttachment.status === "analyzing" ? (
                  <ActivityIndicator size="small" color={P.goldDark} />
                ) : (
                  <Ionicons
                    name={attachmentIconName(selectedAttachment)}
                    size={24}
                    color={selectedAttachment.status === "error" ? "#B45442" : P.goldDark}
                  />
                )}
              </View>

              <View style={styles.attachmentCopy}>
                <View style={styles.attachmentTopRow}>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {selectedAttachment.name}
                  </Text>
                  <Pressable
                    style={[
                      styles.attachmentClearBtn,
                      selectedAttachment.status === "analyzing" && styles.attachmentClearBtnDisabled,
                    ]}
                    disabled={selectedAttachment.status === "analyzing"}
                    onPress={clearAttachmentSelection}
                  >
                    <Ionicons name="close" size={18} color={P.mutedDark} />
                  </Pressable>
                </View>

                <View style={styles.attachmentMetaRow}>
                  <View style={styles.attachmentPill}>
                    <Text style={styles.attachmentPillText}>
                      {attachmentCategoryLabel(selectedAttachment.category)}
                    </Text>
                  </View>
                  <Text style={styles.attachmentStatusText}>
                    {selectedAttachment.status === "analyzing"
                      ? "Analyzing"
                      : selectedAttachment.status === "ready"
                        ? "Ready"
                        : selectedAttachment.status === "error"
                          ? "Needs retry"
                          : "Selected"}
                  </Text>
                  {selectedAttachment.confidence != null ? (
                    <Text style={styles.attachmentConfidenceText}>
                      {selectedAttachment.confidence}% confidence
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {selectedAttachment.mimeType !== "application/pdf" ? (
              <View style={styles.attachmentPreviewWrap}>
                <Image
                  source={{ uri: selectedAttachment.uri }}
                  style={styles.attachmentPreview}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            <Text style={styles.attachmentSummary}>
              {selectedAttachment.status === "error"
                ? selectedAttachment.error || "This attachment could not be analyzed."
                : selectedAttachment.analysisSummary || "Attachment selected. Ask a question about it after the analysis finishes."}
            </Text>

            <Text style={styles.attachmentHint}>{buildAttachmentHint(selectedAttachment)}</Text>
          </View>
        ) : null}

        {!hasResult ? (
          <Animated.View style={[styles.domainOrbitSection, { transform: [{ rotate: orbitRotate }] }]}>
            <View style={styles.orbitRing} />
            <DomainBubble
              label={askDomains[0].label}
              icon={askDomains[0].icon}
              bubble={askDomains[0].bubble}
              iconColor={askDomains[0].iconColor}
              style={styles.domainTop}
              counterRotate={counterRotate}
            />
            <DomainBubble
              label={askDomains[1].label}
              icon={askDomains[1].icon}
              bubble={askDomains[1].bubble}
              iconColor={askDomains[1].iconColor}
              style={styles.domainLeft}
              counterRotate={counterRotate}
            />
            <DomainBubble
              label={askDomains[2].label}
              icon={askDomains[2].icon}
              bubble={askDomains[2].bubble}
              iconColor={askDomains[2].iconColor}
              style={styles.domainRight}
              counterRotate={counterRotate}
            />
            <DomainBubble
              label={askDomains[3].label}
              icon={askDomains[3].icon}
              bubble={askDomains[3].bubble}
              iconColor={askDomains[3].iconColor}
              style={styles.domainBottomLeft}
              counterRotate={counterRotate}
            />
            <DomainBubble
              label={askDomains[4].label}
              icon={askDomains[4].icon}
              bubble={askDomains[4].bubble}
              iconColor={askDomains[4].iconColor}
              style={styles.domainBottomRight}
              counterRotate={counterRotate}
            />
          </Animated.View>
        ) : (
          <ScrollView
            style={styles.resultsScroll}
            contentContainerStyle={styles.resultsScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {transcript ? (
              <View style={styles.resultCard}>
                <Text style={styles.resultEyebrow}>You said</Text>
                <Text style={styles.resultBody}>{transcript}</Text>
              </View>
            ) : null}

            {responseText ? (
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultEyebrow}>Assistant</Text>
                  {lastCommand?.domain ? (
                    <View style={styles.domainPill}>
                      <Text style={styles.domainPillText}>{lastCommand.domain}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.resultBody}>{responseText}</Text>
              </View>
            ) : null}

            {currentVisualization ? (
              <View style={styles.visualizationWrap}>
                <VisualizationCardRenderer card={currentVisualization} />
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>

      <Pressable style={[styles.cameraFab, { left: 26, bottom: insets.bottom + 30 }]} onPress={openAttachmentPicker}>
        <Ionicons name="camera" size={26} color={P.surface} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  container: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 6,
    alignItems: "center",
  },
  topRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  topIconBtn: {
    position: "absolute",
    right: 0,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  brandLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  brand: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 3.2,
    color: P.ink,
  },
  hindiHeading: {
    marginTop: 10,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    color: P.ink,
    textAlign: "center",
  },
  heroSection: {
    marginTop: 16,
    width: 240,
    height: 170,
    alignItems: "center",
    justifyContent: "center",
  },
  sideDotsLeft: {
    position: "absolute",
    left: 4,
    top: 88,
    flexDirection: "row",
    gap: 10,
  },
  sideDotsRight: {
    position: "absolute",
    right: 4,
    top: 88,
    flexDirection: "row",
    gap: 10,
  },
  sideDot: {
    width: 8,
    height: 18,
    borderRadius: 8,
    backgroundColor: P.goldSoft,
    opacity: 0.9,
  },
  sideDotCenter: {
    height: 24,
    backgroundColor: P.gold,
  },
  heroHalo: {
    position: "absolute",
    width: HERO_SIZE + 34,
    height: HERO_SIZE + 34,
    borderRadius: (HERO_SIZE + 34) / 2,
    backgroundColor: P.goldTint,
  },
  heroRing: {
    width: HERO_SIZE + 12,
    height: HERO_SIZE + 12,
    borderRadius: (HERO_SIZE + 12) / 2,
    borderWidth: 5,
    borderColor: P.gold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: P.surface,
  },
  heroButton: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    borderRadius: HERO_SIZE / 2,
    backgroundColor: P.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: P.goldDark,
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  heroButtonActive: {
    backgroundColor: P.goldDark,
  },
  heroButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "900",
    color: P.ink,
    textAlign: "center",
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: P.muted,
    textAlign: "center",
    maxWidth: 300,
  },
  attachmentCard: {
    width: "100%",
    marginTop: 16,
    backgroundColor: P.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: P.line,
    padding: 14,
    shadowColor: P.goldShadow,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  attachmentHeader: {
    flexDirection: "row",
    gap: 12,
  },
  attachmentIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: P.goldTint,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentCopy: {
    flex: 1,
  },
  attachmentPreviewWrap: {
    marginTop: 12,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: P.lineSoft,
    backgroundColor: P.surfaceSoft,
  },
  attachmentPreview: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: P.surfaceSoft,
  },
  attachmentTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  attachmentName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    color: P.ink,
  },
  attachmentClearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: P.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentClearBtnDisabled: {
    opacity: 0.45,
  },
  attachmentMetaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  attachmentPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: P.goldTint,
  },
  attachmentPillText: {
    fontSize: 10,
    fontWeight: "900",
    color: P.goldDark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  attachmentStatusText: {
    fontSize: 12,
    fontWeight: "700",
    color: P.mutedDark,
  },
  attachmentConfidenceText: {
    fontSize: 12,
    fontWeight: "700",
    color: P.goldDark,
  },
  attachmentSummary: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: P.ink,
  },
  attachmentHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    color: P.goldDark,
  },
  resultsScroll: {
    flex: 1,
    width: "100%",
    marginTop: 10,
  },
  resultsScrollContent: {
    gap: 10,
    paddingBottom: 20,
  },
  resultCard: {
    backgroundColor: P.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: P.line,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: P.goldShadow,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resultEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: P.goldDark,
  },
  resultBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
    color: P.ink,
  },
  domainPill: {
    backgroundColor: P.goldTint,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  domainPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: P.goldDark,
    textTransform: "capitalize",
  },
  visualizationWrap: {
    width: "100%",
  },
  domainOrbitSection: {
    width: 290,
    height: 290,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitRing: {
    position: "absolute",
    top: 45,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: P.lineSoft,
    borderStyle: "dashed",
  },
  domainNode: {
    position: "absolute",
    alignItems: "center",
    width: 100,
  },
  domainCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: P.goldShadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  domainLabel: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "800",
    color: P.ink,
    textAlign: "center",
  },
  domainTop: {
    top: 0,
  },
  domainLeft: {
    left: 0,
    top: 76,
  },
  domainRight: {
    right: 0,
    top: 76,
  },
  domainBottomLeft: {
    left: 14,
    bottom: 10,
  },
  domainBottomRight: {
    right: 14,
    bottom: 10,
  },
  cameraFab: {
    position: "absolute",
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#B9BAC4",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#A8A9B2",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
});

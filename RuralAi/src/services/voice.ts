/**
 * Frontend voice service – handles recording, API calls, and audio playback.
 * Uses expo-audio for microphone + playback, backend /voice/* endpoints for AI.
 *
 * Exports:
 * - Standalone functions (chatWithText, chatWithAudio, etc.) for use anywhere
 * - useVoiceService() hook for recording/playback (needs React component context)
 * - requestMicPermission, startRecording, stopRecording etc. as top-level for backward compat
 */

import {
  AudioModule,
  useAudioRecorder,
  useAudioPlayer,
  RecordingPresets,
} from "expo-audio";

import api from "./api";
import { useRef } from "react";
import { logger } from "../utils/logger";

/* ────────────────────────────────────────────── */
/*  Language normaliser (short code → BCP-47)    */
/* ────────────────────────────────────────────── */

/**
 * AWS Transcribe / Sarvam require full BCP-47 codes.
 * Map common short codes so callers can use "hi", "en", etc.
 */
const BCP47_MAP: Record<string, string> = {
  hi: "hi-IN",
  en: "en-IN",
  ta: "ta-IN",
  te: "te-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  mr: "mr-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  or: "or-IN",
  "en-us": "en-US",
  "en-gb": "en-GB",
};

function toBCP47(code: string): string {
  if (!code) return "hi-IN";
  // Already full BCP-47 (contains a dash)
  if (code.includes("-")) return code;
  return BCP47_MAP[code.toLowerCase()] ?? `${code}-IN`;
}

/* ────────────────────────────────────────────── */
/*  Types                                        */
/* ────────────────────────────────────────────── */

export interface TranscribeResult {
  transcript: string;
  language_code: string;
  confidence?: number;
  provider?: string;
}

export interface PipelineStage {
  provider?: string;
  ms?: number;
  error?: string;
  [key: string]: unknown;
}

export interface PipelineInfo {
  stages: {
    stt?: PipelineStage;
    nova?: PipelineStage;
    agent?: PipelineStage;
    sarvam?: PipelineStage;
  };
}

export interface ChatResult {
  response_text: string;
  response_text_english?: string;
  audio_base64: string;
  session_id: string;
  language_code: string;
  provider: string;
  response_time_ms: number;
  transcript?: string;

  domain?: string;
  intent?: string;
  entities?: Record<string, string>;
  complexity?: string;
  route?: string;
  metadata?: {
    action?: string;
    roomId?: string;
    roomTitle?: string;
    topic?: string;
    entities?: Record<string, string>;
    [key: string]: unknown;
  };
  pipeline?: PipelineInfo;
  error?: string;
}

export interface VoiceLanguage {
  code: string;
  bcp47: string;
  name: string;
  tts_speaker: string | null;
  tts_available: boolean;
  transcribe_supported?: boolean;
}

export interface AIAgent {
  name: string;
  description: string;
  supportedIntents: string[];
}

export interface SessionSummary {
  sessionId: string;
  firstMessage: string;
  lastActivity: string;
  turnCount: number;
}

export interface SessionTurn {
  role: "user" | "assistant";
  text: string;
  language: string;
  timestamp: string;
}

/* ────────────────────────────────────────────── */
/*  Voice Hook (Recording + Playback)             */
/* ────────────────────────────────────────────── */

export function useVoiceService() {

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer();

  const isRecordingRef = useRef(false);

  /* ───────── Permission ───────── */

  async function _requestMicPermission(): Promise<boolean> {
    const result = await AudioModule.requestRecordingPermissionsAsync();
    return result.granted;
  }

  /* ───────── Recording ───────── */

  async function _startRecording(): Promise<void> {
    try {
      await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      recorder.record();
      isRecordingRef.current = true;
      logger.info("Voice", "Recording started");
    } catch (err: any) {
      logger.error("Voice", "startRecording error", err);
    }
  }

  async function _stopRecording(): Promise<string | null> {
    try {
      await recorder.stop();
      isRecordingRef.current = false;
      const uri = recorder.uri ?? null;
      logger.info("Voice", "Recording stopped", { uri: uri?.substring(0, 50) });
      return uri;
    } catch (err: any) {
      logger.error("Voice", "stopRecording error", err);
      return null;
    }
  }

  async function _cancelRecording(): Promise<void> {
    try {
      await recorder.stop();
    } catch {}
    isRecordingRef.current = false;
  }

  function _isRecording(): boolean {
    return isRecordingRef.current;
  }

  /* ───────── Playback ───────── */

  async function _playBase64Audio(base64: string): Promise<void> {
    if (!base64) return;
    return new Promise((resolve, reject) => {
      let hasStarted = false;
      let pollCount = 0;
      let interval: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      };

      try {
        const uri = `data:audio/wav;base64,${base64}`;
        player.replace({ uri });
        player.play();
        logger.debug("Voice", "Playing audio", { length: base64.length });

        interval = setInterval(() => {
          const status = player.currentStatus;

          if (status.playing) {
            hasStarted = true;
          }

          if (status.didJustFinish || (hasStarted && !status.playing && !status.isBuffering)) {
            cleanup();
            resolve();
            return;
          }

          pollCount += 1;
          if (pollCount >= 300) {
            cleanup();
            resolve();
          }
        }, 100);
      } catch (err: any) {
        cleanup();
        logger.error("Voice", "Playback error", err);
        reject(err);
      }
    });
  }

  async function _stopPlayback(): Promise<void> {
    try {
      player.pause();
    } catch {}
  }

  return {
    requestMicPermission: _requestMicPermission,
    startRecording: _startRecording,
    stopRecording: _stopRecording,
    cancelRecording: _cancelRecording,
    isRecording: _isRecording,
    playBase64Audio: _playBase64Audio,
    stopPlayback: _stopPlayback,
    chatWithText,
    chatWithAudio,
    getLanguages,
    getAgents,
    getSessions,
    getSessionHistory,
    getMemoryFacts,
    synthesize,
    translateText,
  };
}

/* ────────────────────────────────────────────── */
/*  Standalone Functions (no React hook needed)   */
/* ────────────────────────────────────────────── */

/** Request microphone permission (standalone, no hook) */
export async function requestMicPermission(): Promise<boolean> {
  const result = await AudioModule.requestRecordingPermissionsAsync();
  return result.granted;
}

/** Chat with AI using text */
export async function chatWithText(
  text: string,
  opts: {
    language_code?: string;
    language?: string;
    session_id?: string;
    generate_audio?: boolean;
    screen_context?: string;
  } = {}
): Promise<ChatResult> {
  const start = Date.now();
  const langCode = toBCP47(opts.language_code ?? opts.language ?? "hi-IN");

  logger.info("Voice", "chatWithText \u2192 sending", {
    textLength: text.length,
    textPreview: text.substring(0, 60),
    language: langCode,
    screenContext: opts.screen_context?.substring(0, 80),
  });

  const result = await api.postVoice<ChatResult>("/voice/chat", {
    text,
    language_code: langCode,
    session_id: opts.session_id,
    generate_audio: opts.generate_audio ?? true,
    screen_context: opts.screen_context,
  });

  const elapsed = Date.now() - start;
  logger.info("Voice", `chatWithText ← response in ${elapsed}ms`, {
    domain: result.domain,
    intent: result.intent,
    provider: result.provider,
    route: result.route,
    language: result.language_code,
    responsePreview: (result.response_text || "").substring(0, 80),
    hasAudio: !!result.audio_base64,
    pipelineMs: result.response_time_ms,
    pipeline: result.pipeline,
    error: (result as any).error,
  });

  return result;
}

/** Chat with AI using audio (single pipeline call) */
export async function chatWithAudio(
  audioBase64: string,
  opts: {
    language_code?: string;
    session_id?: string;
    screen_context?: string;
    generate_audio?: boolean;
  } = {}
): Promise<ChatResult> {
  const start = Date.now();
  const langCode = toBCP47(opts.language_code ?? "hi-IN");
  logger.info("Voice", "chatWithAudio \u2192 sending", {
    audioBytes: audioBase64.length,
    language: langCode,
    sessionId: opts.session_id?.substring(0, 8),
    screenContext: opts.screen_context?.substring(0, 80),
  });

  const result = await api.postVoice<ChatResult>("/voice/chat/audio", {
    audio_base64: audioBase64,
    language_code: langCode,
    session_id: opts.session_id,
    screen_context: opts.screen_context,
    generate_audio: opts.generate_audio ?? true,
  });

  const elapsed = Date.now() - start;
  logger.info("Voice", `chatWithAudio ← response in ${elapsed}ms`, {
    transcript: (result.transcript || "").substring(0, 80),
    domain: result.domain,
    intent: result.intent,
    provider: result.provider,
    route: result.route,
    language: result.language_code,
    responsePreview: (result.response_text || "").substring(0, 80),
    hasAudio: !!result.audio_base64,
    audioBase64Len: result.audio_base64?.length || 0,
    pipelineMs: result.response_time_ms,
    pipeline: result.pipeline,
    error: (result as any).error,
  });

  return result;
}

/** Get supported languages */
export async function getLanguages(): Promise<{
  languages: VoiceLanguage[];
  total: number;
  stt_primary: string;
  stt_fallback: string;
  tts_model: string;
  routing_model: string;
}> {
  return api.get("/voice/languages");
}

/** Get available AI agents */
export async function getAgents(): Promise<{ agents: AIAgent[] }> {
  return api.get("/voice/agents");
}

/** Get voice sessions */
export async function getSessions(limit = 10): Promise<{
  sessions: SessionSummary[];
}> {
  return api.get("/voice/sessions", { limit });
}

/** Get session history */
export async function getSessionHistory(
  sessionId: string,
  limit = 50
): Promise<{
  session_id: string;
  turns: SessionTurn[];
}> {
  return api.get(`/voice/sessions/${sessionId}`, { limit });
}

/** Get memory facts */
export async function getMemoryFacts(): Promise<{
  facts: Record<string, string>;
}> {
  return api.get("/voice/memory/facts");
}

/** Synthesize text to speech */
export async function synthesize(
  text: string,
  languageCode = "hi"
): Promise<{ audio_base64: string }> {
  return api.post("/voice/synthesize", {
    text,
    language_code: languageCode,
  });
}

/** Translate text */
export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage = "auto"
): Promise<{ translated_text: string }> {
  return api.post("/voice/translate", {
    text,
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
}

/* ────────────────────────────────────────────── */
/*  Dummy stubs for backward compat (standalone)  */
/*  Use useVoiceService() hook for real recording */
/* ────────────────────────────────────────────── */

let _globalRecording = false;
let _lastRecordingUri: string | null = null;

/** Start recording (standalone stub — prefer useVoiceService for real recording) */
export async function startRecording(): Promise<void> {
  logger.warn("Voice", "startRecording called outside hook — using permissions only");
  _globalRecording = true;
}

/** Stop recording (standalone stub) */
export async function stopRecording(): Promise<string | null> {
  _globalRecording = false;
  return _lastRecordingUri;
}

/** Cancel recording (standalone stub) */
export async function cancelRecording(): Promise<void> {
  _globalRecording = false;
}

/** Play base64 audio (standalone — simplified) */
export async function playBase64Audio(base64: string): Promise<void> {
  if (!base64) return;
  logger.debug("Voice", "playBase64Audio (standalone)", { length: base64.length });
  // expo-audio playback requires hook context; this is a no-op standalone
}

/** Stop playback (standalone stub) */
export async function stopPlayback(): Promise<void> {
  // no-op standalone
}

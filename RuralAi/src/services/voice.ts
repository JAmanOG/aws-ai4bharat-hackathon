/**
 * Frontend voice service – handles recording, API calls, and audio playback.
 * Uses expo-av for microphone + playback, backend /voice/* endpoints for AI.
 */

import { Audio } from 'expo-av';
import api from './api';

/* ────────────────────────────────────────────── */
/*  Types                                          */
/* ────────────────────────────────────────────── */

export interface TranscribeResult {
  transcript: string;
  language_code: string;
  confidence?: number;
  provider?: string; // 'amazon-transcribe' | 'sarvam-stt'
}

export interface PipelineStage {
  stage: string;
  duration_ms: number;
  provider?: string;
}

export interface ChatResult {
  response_text: string;
  response_text_english?: string;
  audio_base64: string;
  session_id: string;
  language_code: string;
  provider: string;
  response_time_ms: number;
  transcript?: string; // present when audio input used

  // New orchestrator fields
  domain?: string;        // 'agriculture' | 'market' | 'schemes' | 'health' | 'general'
  intent?: string;        // e.g. 'crop_advice', 'get_prices'
  entities?: Record<string, string>;
  complexity?: string;    // 'simple' | 'moderate' | 'complex'
  route?: string;         // which agent/model handled the response
  pipeline?: PipelineStage[];
}

export interface VoiceLanguage {
  code: string;
  bcp47: string;
  name: string;
  tts_speaker: string | null;
  tts_available: boolean;
  transcribe_supported?: boolean; // Amazon Transcribe coverage
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
  role: 'user' | 'assistant';
  text: string;
  language: string;
  timestamp: string;
}

/* ────────────────────────────────────────────── */
/*  Recording                                      */
/* ────────────────────────────────────────────── */

let _recording: Audio.Recording | null = null;

/** Request microphone permission */
export async function requestMicPermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

/** Start recording audio */
export async function startRecording(): Promise<void> {
  if (_recording) {
    try { await _recording.stopAndUnloadAsync(); } catch {}
    _recording = null;
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );
  _recording = recording;
}

/** Stop recording and return the file URI */
export async function stopRecording(): Promise<string | null> {
  if (!_recording) return null;
  try {
    await _recording.stopAndUnloadAsync();
    const uri = _recording.getURI();
    _recording = null;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    return uri;
  } catch (err) {
    console.warn('[Voice] Stop recording error:', err);
    _recording = null;
    return null;
  }
}

/** Cancel active recording without saving */
export async function cancelRecording(): Promise<void> {
  if (!_recording) return;
  try {
    await _recording.stopAndUnloadAsync();
  } catch {}
  _recording = null;
}

export function isRecording(): boolean {
  return _recording !== null;
}

/* ────────────────────────────────────────────── */
/*  Audio Playback                                 */
/* ────────────────────────────────────────────── */

let _sound: Audio.Sound | null = null;

/** Play base64-encoded WAV audio */
export async function playBase64Audio(base64: string): Promise<void> {
  if (!base64) return;

  // Stop any currently playing audio
  await stopPlayback();

  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: `data:audio/wav;base64,${base64}` },
      { shouldPlay: true },
    );
    _sound = sound;

    // Auto-cleanup when done
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (_sound === sound) _sound = null;
      }
    });
  } catch (err) {
    console.warn('[Voice] Playback error:', err);
  }
}

/** Stop currently playing audio */
export async function stopPlayback(): Promise<void> {
  if (!_sound) return;
  try {
    await _sound.stopAsync();
    await _sound.unloadAsync();
  } catch {}
  _sound = null;
}

/* ────────────────────────────────────────────── */
/*  Voice API calls                                */
/* ────────────────────────────────────────────── */

/** Text chat with LLM + optional TTS */
export async function chatWithText(
  text: string,
  opts: {
    language_code?: string;
    session_id?: string;
    generate_audio?: boolean;
  } = {},
): Promise<ChatResult> {
  return api.post<ChatResult>('/voice/chat', {
    text,
    language_code: opts.language_code ?? 'hi',
    session_id: opts.session_id,
    generate_audio: opts.generate_audio ?? true,
  });
}

/** Get available voice languages */
export async function getLanguages(): Promise<{
  languages: VoiceLanguage[];
  total: number;
  stt_primary: string;
  stt_fallback: string;
  tts_model: string;
  routing_model: string;
}> {
  return api.get('/voice/languages');
}

/** Get available AI agents */
export async function getAgents(): Promise<{ agents: AIAgent[] }> {
  return api.get('/voice/agents');
}

/** Get user's conversation sessions */
export async function getSessions(limit = 10): Promise<{
  sessions: SessionSummary[];
}> {
  return api.get('/voice/sessions', { limit });
}

/** Get a session's conversation history */
export async function getSessionHistory(sessionId: string, limit = 50): Promise<{
  session_id: string;
  turns: SessionTurn[];
}> {
  return api.get(`/voice/sessions/${sessionId}`, { limit });
}

/** Get user's extracted memory facts */
export async function getMemoryFacts(): Promise<{
  facts: Record<string, string>;
}> {
  return api.get('/voice/memory/facts');
}

/** Synthesize text to speech */
export async function synthesize(
  text: string,
  languageCode = 'hi',
): Promise<{ audio_base64: string }> {
  return api.post('/voice/synthesize', {
    text,
    language_code: languageCode,
  });
}

/** Translate text between languages */
export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage = 'auto',
): Promise<{ translated_text: string }> {
  return api.post('/voice/translate', {
    text,
    source_language: sourceLanguage,
    target_language: targetLanguage,
  });
}

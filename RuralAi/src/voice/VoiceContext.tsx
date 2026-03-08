/**
 * VoiceContext — Global voice state for the entire app.
 *
 * Provides:
 * - Persistent recording/playback state
 * - Current voice command result (domain, intent, entities, visualization)
 * - Navigation dispatch from any screen
 * - Auto-listen mode toggle
 *
 * Every screen in the app can consume this context to react to voice commands.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  resolveCommand,
  shouldAutoNavigate,
  type CommandAction,
  type VisualizationCard,
  type VoiceCommand,
} from "./VoiceCommandEngine";
import type { ChatResult } from "../services/voice";
import {
  readStoredLanguagePreference,
  toVoiceLanguageCode,
  writeStoredLanguagePreference,
} from "../utils/languagePreference";
import {
  APP_PREFERENCE_KEYS,
  readStoredBooleanPreference,
  writeStoredBooleanPreference,
} from "../utils/appPreferences";

/* ─── Types ─── */

export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "visualizing";

export interface VoiceContextValue {
  /** Current voice pipeline state */
  state: VoiceState;
  setState: (s: VoiceState) => void;

  /** Last processed command */
  lastCommand: VoiceCommand | null;
  /** Last resolved action(s) */
  lastAction: CommandAction | null;
  /** Current visualization card to show on screen */
  currentVisualization: VisualizationCard | null;

  /** Transcript of whatever user just said */
  transcript: string;
  /** AI response text */
  responseText: string;
  /** Whether audio is playing */
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;

  /** Process a ChatResult from the pipeline into commands */
  processResult: (result: ChatResult) => CommandAction | null;

  /** Clear current visualization */
  clearVisualization: () => void;

  /** Navigation callback set by the overlay */
  navigateRef: React.MutableRefObject<((screen: string, params?: any) => void) | null>;

  /** Auto-listen: after AI finishes speaking, start listening again */
  autoListen: boolean;
  setAutoListen: (v: boolean) => void;

  /** Text-to-speech playback */
  ttsEnabled: boolean;
  setTtsEnabled: (v: boolean) => void;

  /** Reduce audio-heavy responses */
  lowDataMode: boolean;
  setLowDataMode: (v: boolean) => void;

  /** Session tracking */
  sessionId: string | null;
  setSessionId: (id: string) => void;

  /** Language */
  language: string;
  setLanguage: (l: string) => void;

  /** Conversation history (last N for display) */
  history: HistoryEntry[];
  addHistory: (entry: HistoryEntry) => void;
  clearHistory: () => void;
}

export interface HistoryEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  domain?: string;
  intent?: string;
  visualization?: VisualizationCard;
  audioBase64?: string;
}

/* ─── Context ─── */

const VoiceCtx = createContext<VoiceContextValue | null>(null);

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceCtx);
  if (!ctx) throw new Error("useVoice must be used within VoiceProvider");
  return ctx;
}

/* ─── Provider ─── */

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<VoiceState>("idle");
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [lastAction, setLastAction] = useState<CommandAction | null>(null);
  const [currentVisualization, setCurrentVisualization] = useState<VisualizationCard | null>(null);
  const [transcript, setTranscript] = useState("");
  const [responseText, setResponseText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoListen, setAutoListenState] = useState(true);
  const [ttsEnabled, setTtsEnabledState] = useState(true);
  const [lowDataMode, setLowDataModeState] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [language, setLanguageState] = useState("hi-IN");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const navigateRef = useRef<((screen: string, params?: any) => void) | null>(null);

  const addHistory = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => [...prev.slice(-49), entry]); // keep last 50
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  const clearVisualization = useCallback(() => {
    setCurrentVisualization(null);
  }, []);

  useEffect(() => {
    Promise.all([
      readStoredLanguagePreference().catch(() => null),
      readStoredBooleanPreference(APP_PREFERENCE_KEYS.autoListen, true).catch(() => true),
      readStoredBooleanPreference(APP_PREFERENCE_KEYS.ttsEnabled, true).catch(() => true),
      readStoredBooleanPreference(APP_PREFERENCE_KEYS.lowDataMode, false).catch(() => false),
    ]).then(([storedLanguage, storedAutoListen, storedTtsEnabled, storedLowDataMode]) => {
      if (storedLanguage) setLanguageState(toVoiceLanguageCode(storedLanguage));
      setAutoListenState(storedAutoListen);
      setTtsEnabledState(storedTtsEnabled);
      setLowDataModeState(storedLowDataMode);
    });
  }, []);

  const setLanguage = useCallback((nextLanguage: string) => {
    setLanguageState(toVoiceLanguageCode(nextLanguage));
    writeStoredLanguagePreference(nextLanguage).catch(() => {});
  }, []);

  const setAutoListen = useCallback((nextValue: boolean) => {
    setAutoListenState(nextValue);
    writeStoredBooleanPreference(APP_PREFERENCE_KEYS.autoListen, nextValue).catch(() => {});
  }, []);

  const setTtsEnabled = useCallback((nextValue: boolean) => {
    setTtsEnabledState(nextValue);
    writeStoredBooleanPreference(APP_PREFERENCE_KEYS.ttsEnabled, nextValue).catch(() => {});
  }, []);

  const setLowDataMode = useCallback((nextValue: boolean) => {
    setLowDataModeState(nextValue);
    writeStoredBooleanPreference(APP_PREFERENCE_KEYS.lowDataMode, nextValue).catch(() => {});
  }, []);

  const processResult = useCallback(
    (result: ChatResult): CommandAction | null => {
      const metadataEntities =
        result.metadata?.entities && typeof result.metadata.entities === "object"
          ? (result.metadata.entities as Record<string, string>)
          : {};

      // Build VoiceCommand from ChatResult
      const cmd: VoiceCommand = {
        domain: result.domain ?? "general",
        intent: result.intent ?? "general_question",
        entities: {
          ...(result.entities ?? {}),
          ...metadataEntities,
          ...(result.metadata?.roomId ? { roomId: String(result.metadata.roomId) } : {}),
        },
        complexity: result.complexity ?? "simple",
        transcript: result.transcript,
        responseText: result.response_text,
        responseTextEnglish: result.response_text_english,
        audioBase64: result.audio_base64,
        metadata: {
          ...(result.metadata ?? {}),
          languageCode: result.language_code,
        },
      };

      setLastCommand(cmd);
      setTranscript(result.transcript ?? "");
      setResponseText(result.response_text);
      if (result.session_id) setSessionId(result.session_id);

      // Add user turn to history
      if (result.transcript) {
        addHistory({
          id: `u-${Date.now()}`,
          role: "user",
          text: result.transcript,
          timestamp: Date.now(),
        });
      }

      // Resolve command to action(s)
      const action = resolveCommand(cmd);
      setLastAction(action);

      // Extract visualization
      let viz: VisualizationCard | null = null;
      if (action.type === "visualize") {
        viz = action.visualization;
      } else if (action.type === "multi") {
        const vizAction = action.actions.find((a) => a.type === "visualize");
        if (vizAction?.type === "visualize") viz = vizAction.visualization;
      }
      setCurrentVisualization(viz);

      // Add assistant turn to history
      addHistory({
        id: `a-${Date.now()}`,
        role: "assistant",
        text: result.response_text,
        timestamp: Date.now(),
        domain: result.domain,
        intent: result.intent,
        visualization: viz ?? undefined,
        audioBase64: result.audio_base64,
      });

      // Auto-navigate if appropriate
      if (shouldAutoNavigate(cmd) && navigateRef.current) {
        let navScreen: string | null = null;
        let navParams: any = undefined;

        if (action.type === "navigate") {
          navScreen = action.screen;
          navParams = action.params;
        } else if (action.type === "multi") {
          const navAction = action.actions.find((a) => a.type === "navigate");
          if (navAction?.type === "navigate") {
            navScreen = navAction.screen;
            navParams = navAction.params;
          }
        }

        if (navScreen) {
          // Small delay to let visualization render first
          setTimeout(() => navigateRef.current?.(navScreen!, navParams), 400);
        }
      }

      setState("visualizing");
      return action;
    },
    [addHistory]
  );

  const value = useMemo<VoiceContextValue>(
    () => ({
      state,
      setState,
      lastCommand,
      lastAction,
      currentVisualization,
      transcript,
      responseText,
      isPlaying,
      setIsPlaying,
      processResult,
      clearVisualization,
      navigateRef,
      autoListen,
      setAutoListen,
      ttsEnabled,
      setTtsEnabled,
      lowDataMode,
      setLowDataMode,
      sessionId,
      setSessionId,
      language,
      setLanguage,
      history,
      addHistory,
      clearHistory,
    }),
    [
      state,
      lastCommand,
      lastAction,
      currentVisualization,
      transcript,
      responseText,
      isPlaying,
      processResult,
      clearVisualization,
      autoListen,
      setAutoListen,
      ttsEnabled,
      setTtsEnabled,
      lowDataMode,
      setLowDataMode,
      sessionId,
      language,
      history,
      addHistory,
      clearHistory,
    ]
  );

  return <VoiceCtx.Provider value={value}>{children}</VoiceCtx.Provider>;
}

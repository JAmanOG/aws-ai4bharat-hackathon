/**
 * DemoContext — Automated demo-mode engine (v2).
 *
 * Runs a scripted sequence of steps showcasing every major feature.
 * All voice interactions happen from the Ask screen (the voice hub).
 * After each AI response + audio, the engine navigates to the relevant
 * screen, pauses there for showcase, then returns to Ask for the next query.
 *
 * Flow:
 *   Ask (hub) → query → AI audio → navigate to feature screen → pause →
 *   back to Ask → next query → …
 *
 * Key design:
 * - Uses chatWithText (skips mic recording)
 * - Plays AI audio via playBase64Audio
 * - processResult for visualization / history
 * - navigateRef for screen navigation
 * - Longer pauses so each screen is properly visible for demo recording
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ────────────────────────────────────── */
/*  Types                                  */
/* ────────────────────────────────────── */

export type DemoStepKind =
  | "navigate"      // navigate to a screen (no AI call)
  | "query"         // send text via chatWithText → processResult → play audio
  | "pause"         // just wait N ms (e.g., admire the screen)
  | "goAsk"         // navigate back to Ask tab (the voice hub)
  | "navigateTab"   // switch to a specific bottom tab
  | "screenAction"; // trigger a registered action inside the current screen

export interface DemoStep {
  id: string;
  /** Human-readable label shown in the overlay banner */
  label: string;
  kind: DemoStepKind;
  /** Text to send via chatWithText (kind = "query") */
  queryText?: string;
  /** Screen to navigate to (kind = "navigate") — uses HomeStack */
  screen?: string;
  screenParams?: Record<string, any>;
  /** Registered screen action target and action name (kind = "screenAction") */
  actionTarget?: string;
  actionName?: string;
  actionPayload?: Record<string, any>;
  /** Tab name for navigateTab kind */
  tab?: string;
  /** Pause duration in ms (kind = "pause") */
  pauseMs?: number;
  /** How long to wait AFTER this step completes before moving on */
  delayAfter?: number;
  /**
   * If true, after the query's audio finishes the engine will NOT
   * auto-navigate (processResult still runs, but we skip its nav).
   * Use when we want to show the result on Ask screen first.
   */
  stayOnAsk?: boolean;
}

export interface DemoState {
  isActive: boolean;
  isPaused: boolean;
  currentStepIndex: number;
  totalSteps: number;
  currentStep: DemoStep | null;
  isProcessing: boolean;
  isPlayingAudio: boolean;
}

export interface DemoContextValue extends DemoState {
  startDemo: () => void;
  stopDemo: () => void;
  pauseDemo: () => void;
  resumeDemo: () => void;
  skipStep: () => void;
}

/* ────────────────────────────────────── */
/*  Demo script (v2 — proper showcase)     */
/* ────────────────────────────────────── */

export const DEMO_STEPS: DemoStep[] = [
  /* ═══════════════════════════════════
   *  INTRO — show Ask screen hub
   * ═══════════════════════════════════ */
  {
    id: "ask-intro",
    label: "Voice Assistant Hub",
    kind: "goAsk",
    delayAfter: 500,
  },
  {
    id: "ask-admire",
    label: "Voice Assistant Hub",
    kind: "pause",
    pauseMs: 4000,
  },

  /* ═══════════════════════════════════
   *  GREETING — "What can you help me with?"
   * ═══════════════════════════════════ */
  {
    id: "greeting",
    label: "\"What can you help me with?\"",
    kind: "query",
    queryText: "Hello, what can you help me with?",
    stayOnAsk: true,
    delayAfter: 4000,
  },

  /* ═══════════════════════════════════
   *  AGRICULTURE — deep exploration
   *  Crops tab → Historical tab
   * ═══════════════════════════════════ */
  {
    id: "agri-query",
    label: "\"What is the price of wheat today?\"",
    kind: "query",
    queryText: "What is the price of wheat today?",
    delayAfter: 2500,
  },
  {
    id: "agri-nav-crops",
    label: "Market — Crops Tab",
    kind: "navigate",
    screen: "AgriMarket",
    screenParams: { crop: "wheat", tab: "crops" },
    delayAfter: 500,
  },
  {
    id: "agri-showcase-crops",
    label: "India Map · Live Mandi Prices · Crop Selector",
    kind: "pause",
    pauseMs: 6000,
  },
  {
    id: "agri-nav-historical",
    label: "Market — Historical Tab",
    kind: "navigate",
    screen: "AgriMarket",
    screenParams: { crop: "wheat", tab: "historical" },
    delayAfter: 500,
  },
  {
    id: "agri-showcase-historical",
    label: "Price Trends · Bar Charts · History Cards",
    kind: "pause",
    pauseMs: 6000,
  },
  {
    id: "agri-back",
    label: "Returning to Voice Hub",
    kind: "goAsk",
    delayAfter: 2000,
  },

  /* ═══════════════════════════════════
   *  ECONOMICS — deeper exploration
   *  Eligibility → Savings → Schemes → Detail → Insurance
   * ═══════════════════════════════════ */
  {
    id: "loan-query",
    label: "\"I need a loan for farming\"",
    kind: "query",
    queryText: "I need a loan for farming, what government schemes can help?",
    delayAfter: 2500,
  },
  {
    id: "loan-nav",
    label: "Loan Eligibility Screen",
    kind: "navigate",
    screen: "Eligibility",
    delayAfter: 500,
  },
  {
    id: "loan-showcase",
    label: "Readiness Score · KCC · Documents Checklist",
    kind: "pause",
    pauseMs: 6000,
  },
  {
    id: "loan-nav-savings",
    label: "Financial Overview & Savings Plan",
    kind: "navigate",
    screen: "SavingsNudge",
    delayAfter: 500,
  },
  {
    id: "loan-showcase-savings",
    label: "Harvest Summary · Savings Split · Farm Economy Cards",
    kind: "pause",
    pauseMs: 5500,
  },
  {
    id: "loan-nav-schemes",
    label: "Government Schemes Catalogue",
    kind: "navigate",
    screen: "SchemesList",
    delayAfter: 500,
  },
  {
    id: "loan-showcase-schemes",
    label: "PM-KISAN · PMFBY · KCC · Subsidy Filters",
    kind: "pause",
    pauseMs: 4500,
  },
  {
    id: "loan-filter-loans",
    label: "Schemes — Loan Filter",
    kind: "screenAction",
    actionTarget: "SchemesList",
    actionName: "setFilter",
    actionPayload: { filter: "loan", query: "credit" },
    delayAfter: 600,
  },
  {
    id: "loan-filter-loans-showcase",
    label: "KCC · Loan-focused scheme shortlist",
    kind: "pause",
    pauseMs: 3500,
  },
  {
    id: "loan-filter-insurance",
    label: "Schemes — Insurance Filter",
    kind: "screenAction",
    actionTarget: "SchemesList",
    actionName: "setFilter",
    actionPayload: { filter: "insurance", query: "" },
    delayAfter: 600,
  },
  {
    id: "loan-filter-insurance-showcase",
    label: "Insurance-specific schemes and benefits",
    kind: "pause",
    pauseMs: 3500,
  },
  {
    id: "loan-nav-detail",
    label: "Scheme Detail — Kisan Credit Card",
    kind: "navigate",
    screen: "SchemeDetail",
    screenParams: { schemeId: "kisan-credit-card" },
    delayAfter: 500,
  },
  {
    id: "loan-showcase-detail",
    label: "Benefit Summary · Documents · Apply Portal",
    kind: "pause",
    pauseMs: 5000,
  },
  {
    id: "loan-nav-insurance",
    label: "Insurance & Claims",
    kind: "navigate",
    screen: "InsuranceClaims",
    delayAfter: 500,
  },
  {
    id: "loan-open-claim-form",
    label: "Insurance — New Claim Form",
    kind: "screenAction",
    actionTarget: "InsuranceClaims",
    actionName: "showForm",
    delayAfter: 600,
  },
  {
    id: "loan-showcase-claims",
    label: "Coverage · Claim Steps · New Claim Form",
    kind: "pause",
    pauseMs: 5000,
  },
  {
    id: "loan-back",
    label: "Returning to Voice Hub",
    kind: "goAsk",
    delayAfter: 2000,
  },

  /* ═══════════════════════════════════
   *  KNOWLEDGE — deeper exploration
   *  Dashboard → All resources → Videos → Articles
   * ═══════════════════════════════════ */
  {
    id: "knowledge-query",
    label: "\"How to start beekeeping?\"",
    kind: "query",
    queryText: "How can I start beekeeping as a side business?",
    delayAfter: 2500,
  },
  {
    id: "knowledge-nav",
    label: "Knowledge Hub Dashboard",
    kind: "navigate",
    screen: "KnowledgeDashboard",
    delayAfter: 500,
  },
  {
    id: "knowledge-showcase",
    label: "Featured Sources · Popular Courses · Live Streams · Peer Groups",
    kind: "pause",
    pauseMs: 6000,
  },
  {
    id: "knowledge-nav-resources",
    label: "Learning Resources — All Sources",
    kind: "navigate",
    screen: "KnowledgeResources",
    screenParams: { initialTab: "all", query: "beekeeping", language: "hi" },
    delayAfter: 500,
  },
  {
    id: "knowledge-showcase-all-resources",
    label: "Official Sources · Live Streams · Mixed Results",
    kind: "pause",
    pauseMs: 4000,
  },
  {
    id: "knowledge-show-videos",
    label: "Learning Resources — Videos Tab",
    kind: "screenAction",
    actionTarget: "KnowledgeResources",
    actionName: "showVideos",
    delayAfter: 600,
  },
  {
    id: "knowledge-showcase-videos",
    label: "YouTube tutorials and video-led learning",
    kind: "pause",
    pauseMs: 3500,
  },
  {
    id: "knowledge-show-articles",
    label: "Learning Resources — Articles Tab",
    kind: "screenAction",
    actionTarget: "KnowledgeResources",
    actionName: "showArticles",
    delayAfter: 600,
  },
  {
    id: "knowledge-showcase-articles",
    label: "Articles and web learning sources",
    kind: "pause",
    pauseMs: 3500,
  },
  {
    id: "knowledge-back",
    label: "Returning to Voice Hub",
    kind: "goAsk",
    delayAfter: 2000,
  },

  /* ═══════════════════════════════════
   *  COMMUNITY — voice rooms
   * ═══════════════════════════════════ */
  {
    id: "community-nav",
    label: "Live Community Voice Rooms",
    kind: "navigate",
    screen: "VoiceRooms",
    delayAfter: 500,
  },
  {
    id: "community-showcase",
    label: "Live Streams · Moderator Profiles · Room Cards",
    kind: "pause",
    pauseMs: 5000,
  },
  {
    id: "community-open-room",
    label: "Community — Join Top Voice Room",
    kind: "screenAction",
    actionTarget: "VoiceRooms",
    actionName: "openFirstRoom",
    delayAfter: 800,
  },
  {
    id: "community-showcase-room",
    label: "Live Stage · Participants · Voice Room Chat",
    kind: "pause",
    pauseMs: 5000,
  },
  {
    id: "community-back",
    label: "Returning to Voice Hub",
    kind: "goAsk",
    delayAfter: 2000,
  },

  /* ═══════════════════════════════════
   *  HEALTH — deep exploration
   *  Dashboard → Symptom Checker
   * ═══════════════════════════════════ */
  {
    id: "health-query",
    label: "\"Check my health symptoms\"",
    kind: "query",
    queryText: "I have been having chest pain and headache for two days, what could it be?",
    delayAfter: 2500,
  },
  {
    id: "health-nav",
    label: "AI Health Screening Dashboard",
    kind: "navigate",
    screen: "HealthDashboard",
    delayAfter: 500,
  },
  {
    id: "health-showcase",
    label: "Report Upload · Govt Schemes · Doctor Consults",
    kind: "pause",
    pauseMs: 3500,
  },
  {
    id: "health-open-schemes",
    label: "Health — Government Schemes Sheet",
    kind: "screenAction",
    actionTarget: "HealthDashboard",
    actionName: "openSchemes",
    delayAfter: 600,
  },
  {
    id: "health-showcase-schemes",
    label: "Ayushman Bharat · NHM · Health support options",
    kind: "pause",
    pauseMs: 3500,
  },
  {
    id: "health-close-schemes",
    label: "Health — Close Schemes Sheet",
    kind: "screenAction",
    actionTarget: "HealthDashboard",
    actionName: "closeSheet",
    delayAfter: 400,
  },
  {
    id: "health-open-providers",
    label: "Health — Consultation Providers Sheet",
    kind: "screenAction",
    actionTarget: "HealthDashboard",
    actionName: "openProviders",
    delayAfter: 600,
  },
  {
    id: "health-showcase-providers",
    label: "Telemedicine · Hospitals · Pharmacy providers",
    kind: "pause",
    pauseMs: 3500,
  },
  {
    id: "health-close-providers",
    label: "Health — Close Providers Sheet",
    kind: "screenAction",
    actionTarget: "HealthDashboard",
    actionName: "closeSheet",
    delayAfter: 400,
  },
  {
    id: "health-nav-symptom",
    label: "Symptom Checker & Risk Assessment",
    kind: "navigate",
    screen: "SymptomChecker",
    delayAfter: 500,
  },
  {
    id: "health-showcase-symptom",
    label: "AI Symptom Analysis · Risk Profiling",
    kind: "pause",
    pauseMs: 6000,
  },
  {
    id: "health-back",
    label: "Returning to Voice Hub",
    kind: "goAsk",
    delayAfter: 2000,
  },

  /* ═══════════════════════════════════
   *  FINISH
   * ═══════════════════════════════════ */
  {
    id: "done",
    label: "Demo Complete!",
    kind: "pause",
    pauseMs: 4000,
  },
];

/* ────────────────────────────────────── */
/*  Context                                */
/* ────────────────────────────────────── */

const DemoCtx = createContext<DemoContextValue | null>(null);

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoCtx);
  if (!ctx) throw new Error("useDemo must be inside <DemoProvider>");
  return ctx;
}

/* ────────────────────────────────────── */
/*  Engine ref (bridge to DemoRunner)      */
/* ────────────────────────────────────── */

export interface DemoEngineRef {
  advanceStep: () => void;
  setIsProcessing: (v: boolean) => void;
  setIsPlayingAudio: (v: boolean) => void;
  activeRef: React.MutableRefObject<boolean>;
  pausedRef: React.MutableRefObject<boolean>;
  clearTimer: () => void;
  timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

export const demoEngineRef: { current: DemoEngineRef | null } = { current: null };

/* ────────────────────────────────────── */
/*  Provider (with engine ref wiring)      */
/* ────────────────────────────────────── */

export function DemoProviderWithEngine({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const activeRef = useRef(false);
  const pausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentStep =
    isActive && currentStepIndex >= 0 && currentStepIndex < DEMO_STEPS.length
      ? DEMO_STEPS[currentStepIndex]
      : null;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const advanceStep = useCallback(() => {
    if (!activeRef.current) return;
    setCurrentStepIndex((prev) => {
      const next = prev + 1;
      if (next >= DEMO_STEPS.length) {
        activeRef.current = false;
        setIsActive(false);
        setIsPaused(false);
        return -1;
      }
      return next;
    });
  }, []);

  const stopDemo = useCallback(() => {
    activeRef.current = false;
    clearTimer();
    setIsActive(false);
    setIsPaused(false);
    setCurrentStepIndex(-1);
    setIsProcessing(false);
    setIsPlayingAudio(false);
  }, [clearTimer]);

  const startDemo = useCallback(() => {
    activeRef.current = true;
    pausedRef.current = false;
    setIsActive(true);
    setIsPaused(false);
    setCurrentStepIndex(0);
    setIsProcessing(false);
    setIsPlayingAudio(false);
  }, []);

  const pauseDemo = useCallback(() => {
    pausedRef.current = true;
    setIsPaused(true);
  }, []);

  const resumeDemo = useCallback(() => {
    pausedRef.current = false;
    setIsPaused(false);
  }, []);

  const skipStep = useCallback(() => {
    clearTimer();
    setCurrentStepIndex((prev) => {
      const next = prev + 1;
      if (next >= DEMO_STEPS.length) {
        activeRef.current = false;
        setIsActive(false);
        return -1;
      }
      return next;
    });
  }, [clearTimer]);

  // Expose engine internals to DemoRunner
  demoEngineRef.current = {
    advanceStep,
    setIsProcessing,
    setIsPlayingAudio,
    activeRef,
    pausedRef,
    clearTimer,
    timerRef,
  };

  const value = useMemo<DemoContextValue>(
    () => ({
      isActive,
      isPaused,
      currentStepIndex,
      totalSteps: DEMO_STEPS.length,
      currentStep,
      isProcessing,
      isPlayingAudio,
      startDemo,
      stopDemo,
      pauseDemo,
      resumeDemo,
      skipStep,
    }),
    [
      isActive,
      isPaused,
      currentStepIndex,
      currentStep,
      isProcessing,
      isPlayingAudio,
      startDemo,
      stopDemo,
      pauseDemo,
      resumeDemo,
      skipStep,
    ]
  );

  return <DemoCtx.Provider value={value}>{children}</DemoCtx.Provider>;
}

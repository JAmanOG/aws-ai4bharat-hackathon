/**
 * ScreenContext — Global screen-state provider.
 *
 * Tracks what the user is currently viewing so:
 * 1. The voice agent can include screen context in its backend request
 * 2. Screens can react to voice commands by consuming shared state
 * 3. The voice overlay can describe what's on-screen to the LLM
 *
 * Any screen updates this context when it mounts or when key state changes.
 * The voice pipeline reads it before sending requests to the backend.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

/* ─── Types ─── */

export interface ScreenState {
  /** Current screen name (e.g., "AgriMarket", "MarketPrices") */
  screen: string;
  /** Active tab on the current screen */
  tab?: string;
  /** Primary crop being viewed */
  crop?: string;
  /** Comparison crop (if any) */
  compareCrop?: string;
  /** Location filter */
  location?: string;
  /** Any extra metadata screens want to share */
  meta?: Record<string, any>;
}

export interface ScreenContextValue {
  /** Current screen state */
  current: ScreenState;
  /** Update screen state (merges with current) */
  update: (partial: Partial<ScreenState>) => void;
  /** Full replace of screen state */
  set: (state: ScreenState) => void;
  /** Build a context string for the LLM system prompt */
  toPromptContext: () => string;
  /** Ref for imperative reads (no re-render needed) */
  ref: React.MutableRefObject<ScreenState>;
}

const DEFAULT: ScreenState = { screen: "HomeMain" };

const ScreenCtx = createContext<ScreenContextValue | null>(null);

export function useScreenContext(): ScreenContextValue {
  const ctx = useContext(ScreenCtx);
  if (!ctx) throw new Error("useScreenContext must be inside ScreenProvider");
  return ctx;
}

export function ScreenProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ScreenState>(DEFAULT);
  const ref = useRef<ScreenState>(DEFAULT);

  const set = useCallback((state: ScreenState) => {
    ref.current = state;
    setCurrent(state);
  }, []);

  const update = useCallback((partial: Partial<ScreenState>) => {
    setCurrent((prev) => {
      const next = { ...prev, ...partial };
      ref.current = next;
      return next;
    });
  }, []);

  const toPromptContext = useCallback(() => {
    const s = ref.current;
    const parts: string[] = [];
    parts.push(`User is on screen: ${s.screen}`);
    if (s.tab) parts.push(`Active tab: ${s.tab}`);
    if (s.crop) parts.push(`Viewing crop: ${s.crop}`);
    if (s.compareCrop) parts.push(`Comparing with: ${s.compareCrop}`);
    if (s.location) parts.push(`Location: ${s.location}`);
    if (s.meta) {
      for (const [k, v] of Object.entries(s.meta)) {
        if (v != null) parts.push(`${k}: ${v}`);
      }
    }
    return parts.join(". ");
  }, []);

  const value = useMemo<ScreenContextValue>(
    () => ({ current, update, set, toPromptContext, ref }),
    [current, update, set, toPromptContext]
  );

  return <ScreenCtx.Provider value={value}>{children}</ScreenCtx.Provider>;
}

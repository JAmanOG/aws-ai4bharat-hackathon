/**
 * DemoRunner — Executes demo steps inside the authenticated app shell (v2).
 *
 * Must be rendered inside VoiceProvider (for processResult, navigateRef)
 * and inside DemoProviderWithEngine (for step state).
 *
 * Navigation model:
 *  - "goAsk"    → nav.navigate("Main", { screen: "Ask" })
 *  - "navigate" → nav.navigate("Main", { screen: "Home", params: { screen, params } })
 *  - "query"    → chatWithText → processResult → playBase64Audio → delayAfter → advance
 *
 * Pacing is deliberately slow to give each screen proper screen-time for a demo video.
 */

import { useEffect, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import { useVoice } from "../voice/VoiceContext";
import { useVoiceService, chatWithText, type ChatResult } from "../services/voice";
import { useDemo, demoEngineRef, DEMO_STEPS } from "./DemoContext";
import { invokeDemoAction } from "./DemoActions";
import { logger } from "../utils/logger";

export default function DemoRunner() {
  const { isActive, isPaused, currentStepIndex, currentStep } = useDemo();
  const { processResult, language, sessionId, setState: setVoiceState, clearVisualization } = useVoice();
  const voice = useVoiceService();
  const nav = useNavigation<any>();

  // Track which step index we last began executing
  const executedRef = useRef(-1);

  useEffect(() => {
    if (!isActive || !currentStep || isPaused) return;
    if (currentStepIndex === executedRef.current) return;
    executedRef.current = currentStepIndex;

    const engine = demoEngineRef.current;
    if (!engine) return;

    const { advanceStep, setIsProcessing, setIsPlayingAudio, activeRef, pausedRef, timerRef } = engine;
    const step = currentStep;

    logger.info("Demo", `Step ${currentStepIndex + 1}/${DEMO_STEPS.length}: [${step.kind}] ${step.label}`);

    /* ── Helper: delayed advance with pause support ── */
    function delayThen(ms: number, fn: () => void) {
      timerRef.current = setTimeout(() => {
        if (!activeRef.current) return;
        if (pausedRef.current) {
          const poll = setInterval(() => {
            if (!activeRef.current) { clearInterval(poll); return; }
            if (!pausedRef.current) { clearInterval(poll); fn(); }
          }, 250);
          return;
        }
        fn();
      }, ms);
    }

    /* ── Navigate helpers ── */
    function goToAskTab() {
      try {
        nav.navigate("Main", { screen: "Ask" });
      } catch (e) {
        logger.error("Demo", "goToAskTab failed", e);
      }
    }

    function goToHomeStackScreen(screen: string, params?: Record<string, any>) {
      try {
        nav.navigate("Main", {
          screen: "Home",
          params: { screen, params },
        });
      } catch (e) {
        logger.error("Demo", `navigate to ${screen} failed`, e);
      }
    }

    /* ── Execute based on kind ── */

    if (step.kind === "pause") {
      delayThen(step.pauseMs ?? 3000, advanceStep);
      return;
    }

    if (step.kind === "goAsk") {
      goToAskTab();
      delayThen(step.delayAfter ?? 2000, advanceStep);
      return;
    }

    if (step.kind === "navigateTab") {
      try {
        nav.navigate("Main", { screen: step.tab ?? "Ask" });
      } catch {}
      delayThen(step.delayAfter ?? 2000, advanceStep);
      return;
    }

    if (step.kind === "navigate") {
      if (step.screen) {
        goToHomeStackScreen(step.screen, step.screenParams);
      }
      delayThen(step.delayAfter ?? 3000, advanceStep);
      return;
    }

    if (step.kind === "screenAction" && step.actionTarget && step.actionName) {
      let attempts = 0;

      const runScreenAction = () => {
        Promise.resolve(invokeDemoAction(step.actionTarget!, step.actionName!, step.actionPayload))
          .then((handled) => {
            if (handled) {
              delayThen(step.delayAfter ?? 1500, advanceStep);
              return;
            }

            attempts += 1;
            if (!activeRef.current || attempts >= 12) {
              logger.info("Demo", `No demo action registered for ${step.actionTarget}.${step.actionName}`);
              delayThen(step.delayAfter ?? 1500, advanceStep);
              return;
            }

            setTimeout(runScreenAction, 200);
          })
          .catch((err: any) => {
            logger.error("Demo", `screenAction failed for ${step.actionTarget}.${step.actionName}`, err);
            delayThen(step.delayAfter ?? 1500, advanceStep);
          });
      };

      runScreenAction();
      return;
    }

    if (step.kind === "query" && step.queryText) {
      // Make sure we're on Ask tab for the query
      goToAskTab();

      // Small delay to let Ask screen render, then send query
      setTimeout(() => {
        if (!activeRef.current) return;

        setIsProcessing(true);
        setVoiceState("processing");

        chatWithText(step.queryText!, {
          language_code: language,
          session_id: sessionId ?? undefined,
          generate_audio: true,
          screen_context: "ask_screen_demo",
        })
          .then((result: ChatResult) => {
            if (!activeRef.current) return;
            setIsProcessing(false);

            // Process result (adds to history, resolves visualization)
            // NOTE: processResult also calls auto-navigate via navigateRef,
            // but we control navigation ourselves in the demo
            processResult(result);
            setVoiceState("speaking");

            // Play audio
            if (result.audio_base64) {
              setIsPlayingAudio(true);
              voice
                .playBase64Audio(result.audio_base64)
                .then(() => {
                  if (!activeRef.current) return;
                  setIsPlayingAudio(false);
                  setVoiceState("visualizing");
                  delayThen(step.delayAfter ?? 3000, advanceStep);
                })
                .catch(() => {
                  setIsPlayingAudio(false);
                  setVoiceState("visualizing");
                  delayThen(step.delayAfter ?? 3000, advanceStep);
                });
            } else {
              setVoiceState("visualizing");
              delayThen(step.delayAfter ?? 3000, advanceStep);
            }
          })
          .catch((err: any) => {
            logger.error("Demo", "chatWithText failed", err);
            setIsProcessing(false);
            setVoiceState("idle");
            delayThen(1500, advanceStep);
          });
      }, 800); // wait 800ms for Ask tab to render

      return;
    }

    // Fallback — advance
    delayThen(step.delayAfter ?? 2000, advanceStep);
  }, [isActive, isPaused, currentStepIndex, currentStep, processResult, language, sessionId, voice, setVoiceState, nav, clearVisualization]);

  // Reset executedRef when demo stops
  useEffect(() => {
    if (!isActive) {
      executedRef.current = -1;
    }
  }, [isActive]);

  return null;
}

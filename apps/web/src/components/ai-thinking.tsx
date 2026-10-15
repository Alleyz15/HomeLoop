"use client";

import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";

const DEFAULT_AI_PHRASES = [
  "Thinking",
  "Looking at recent sales nearby",
  "Comparing similar homes",
  "Checking the numbers",
  "Writing your explanation",
] as const;

export const ADMIN_AI_THINKING_PHRASES = [
  "Thinking",
  "Reading the application",
  "Checking for mismatches",
  "Drafting a summary",
] as const;

type AiThinkingProps = {
  phrases?: readonly string[];
};

export function AiThinking({ phrases }: AiThinkingProps) {
  const activePhrases = phrases?.length ? phrases : DEFAULT_AI_PHRASES;
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phraseVisible, setPhraseVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let intervalId: number | undefined;
    let fadeId: number | undefined;

    const stopTimers = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
      if (fadeId !== undefined) {
        window.clearTimeout(fadeId);
      }
    };

    const configureMotion = () => {
      stopTimers();
      setReducedMotion(mediaQuery.matches);
      setPhraseIndex(0);
      setPhraseVisible(true);

      if (mediaQuery.matches || activePhrases.length < 2) {
        return;
      }

      intervalId = window.setInterval(() => {
        setPhraseVisible(false);
        fadeId = window.setTimeout(() => {
          setPhraseIndex((current) =>
            current >= activePhrases.length - 1 ? 1 : current + 1,
          );
          setPhraseVisible(true);
        }, 200);
      }, 1800);
    };

    configureMotion();
    mediaQuery.addEventListener("change", configureMotion);

    return () => {
      stopTimers();
      mediaQuery.removeEventListener("change", configureMotion);
    };
  }, [activePhrases]);

  return (
    <Card role="status" aria-live="polite">
      <CardContent className="flex min-h-12 items-center text-sm text-muted-foreground">
        <span className="sr-only">Loading AI explanation</span>
        <span aria-hidden="true" className="inline-flex items-center gap-2">
          {reducedMotion ? (
            <span>Thinking • • •</span>
          ) : (
            <>
              <span
                className={`transition-opacity duration-200 ${
                  phraseVisible ? "opacity-100" : "opacity-0"
                }`}
              >
                {activePhrases[phraseIndex]}
              </span>
              <span className="inline-flex items-center gap-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-1.5 rounded-full bg-muted-foreground animate-bounce motion-reduce:animate-none"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            </>
          )}
        </span>
      </CardContent>
    </Card>
  );
}

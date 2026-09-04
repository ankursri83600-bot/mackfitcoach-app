"use client";

import { useEffect, useRef, useState } from "react";

import { LogoBadge, Wordmark } from "@/components/brand/logo";
import { usePrefersReducedMotion } from "./use-in-view";

/** Hard ceiling — a slow asset must never hold the page hostage. */
const MAX_MS = 1300;
const MIN_MS = 420;

/**
 * Cinematic entry curtain with a real progress counter.
 *
 * Progress tracks font loading plus a minimum dwell — deliberately NOT the
 * window `load` event, which waits for every image on the page and was the
 * single biggest contributor to the site feeling slow. Shown once per session,
 * and skipped entirely under reduced motion, since a preloader is pure theatre
 * and a poor reason to make someone wait.
 */
export function Preloader() {
  const reduced = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const pctRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    // sessionStorage is read in an effect, never during render.
    if (reduced || sessionStorage.getItem("mfc:preloaded") === "1") {
      setActive(false);
      return;
    }

    const started = Date.now();
    let raf = 0;
    let settled = false;
    let fontsDone = false;

    const fonts = document.fonts?.ready ?? Promise.resolve();
    Promise.resolve(fonts)
      .catch(() => {})
      .then(() => {
        fontsDone = true;
      });

    let shown = 0;

    const finish = () => {
      if (settled) return;
      settled = true;
      cancelAnimationFrame(raf);
      if (pctRef.current) pctRef.current.textContent = "100%";
      if (barRef.current) barRef.current.style.width = "100%";
      sessionStorage.setItem("mfc:preloaded", "1");
      setLeaving(true);
      window.setTimeout(() => setActive(false), 620);
    };

    const tick = () => {
      const elapsed = Date.now() - started;
      const byTime = Math.min(1, elapsed / MIN_MS);
      const target = Math.min(byTime, fontsDone ? 1 : 0.85) * 100;

      // Ease toward the target so it neither races nor visibly stalls.
      shown += (target - shown) * 0.18;
      if (pctRef.current) pctRef.current.textContent = `${Math.round(shown)}%`;
      if (barRef.current) barRef.current.style.width = `${shown}%`;

      if (elapsed > MAX_MS || (fontsDone && elapsed > MIN_MS && shown > 97)) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    const hardStop = window.setTimeout(finish, MAX_MS);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hardStop);
    };
  }, [mounted, reduced]);

  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-ink print:hidden"
      style={{
        transform: leaving ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 600ms cubic-bezier(0.83, 0, 0.17, 1)",
      }}
    >
      <div className="relative grid place-items-center">
        <span
          className="absolute size-[132px] rounded-full border border-blood/30 border-t-blood"
          style={{ animation: "spin-slow 1.1s linear infinite" }}
        />
        <LogoBadge size={96} priority />
      </div>

      <Wordmark className="mt-7 items-center text-[1.6rem]" />

      <div className="mt-9 flex w-48 flex-col items-center gap-2">
        <div className="h-px w-full overflow-hidden bg-hairline">
          <div ref={barRef} className="h-full bg-blood" style={{ width: "0%" }} />
        </div>
        <span ref={pctRef} className="font-mono text-caption tabular-nums text-ash">
          0%
        </span>
      </div>
    </div>
  );
}

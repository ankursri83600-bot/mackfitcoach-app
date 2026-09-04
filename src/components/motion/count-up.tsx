"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { useInView, usePrefersReducedMotion } from "./use-in-view";

interface CountUpProps {
  to: number;
  from?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

const format = (v: number, decimals: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(v);

/** easeOutExpo — matches the site's --ease-out-expo curve closely enough. */
const ease = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Counts up when scrolled into view, on a plain rAF loop.
 *
 * The final value is server-rendered so it is correct without JS and there is no
 * hydration mismatch; the animation only ever writes textContent. Going through
 * React state would re-render 60 times a second for a cosmetic effect.
 */
export function CountUp({
  to,
  from = 0,
  duration = 1.6,
  decimals = 0,
  prefix,
  suffix,
  className,
}: CountUpProps) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const { ref, visible } = useInView<HTMLSpanElement>({ threshold: 0.6 });
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!visible || reduced) return;
    const node = valueRef.current;
    if (!node) return;

    let raf = 0;
    let start: number | null = null;
    const totalMs = duration * 1000;

    const tick = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / totalMs);
      node.textContent = format(from + (to - from) * ease(t), decimals);
      if (t < 1) raf = requestAnimationFrame(tick);
      else node.textContent = format(to, decimals);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, reduced, from, to, duration, decimals]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      <span ref={valueRef}>{format(to, decimals)}</span>
      {suffix}
    </span>
  );
}

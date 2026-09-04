"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface MarqueeProps {
  children: ReactNode;
  /** Seconds for one full pass. Lower is faster. */
  duration?: number;
  direction?: "left" | "right";
  pauseOnHover?: boolean;
  className?: string;
  trackClassName?: string;
}

/**
 * Infinite ticker.
 *
 * Pure CSS: the track holds the content twice and translates -50%, so it runs
 * on the compositor with no JS measurement and no resize listener. The
 * duplicate copy is aria-hidden so the content is announced once.
 * The global reduced-motion block in globals.css freezes the animation.
 */
export function Marquee({
  children,
  duration = 28,
  direction = "left",
  pauseOnHover = true,
  className,
  trackClassName,
}: MarqueeProps) {
  return (
    <div className={cn("group relative flex overflow-hidden", className)}>
      <div
        className={cn(
          "flex w-max min-w-full shrink-0 items-center will-change-transform",
          pauseOnHover && "group-hover:[animation-play-state:paused]",
          trackClassName,
        )}
        style={{
          animationName: direction === "left" ? "marquee-left" : "marquee-right",
          animationDuration: `${duration}s`,
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
        }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div className="flex shrink-0 items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Standard separator for marquee content. */
export function MarqueeDot() {
  return (
    <span aria-hidden="true" className="mx-6 inline-block size-1.5 rounded-full bg-blood" />
  );
}

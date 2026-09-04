"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { useInView } from "./use-in-view";

interface SplitTextProps {
  /**
   * A string, or pre-broken lines. Line breaks are an authored decision on
   * purpose — measuring them would differ between server and client and would
   * change on every resize.
   */
  text: string | string[];
  by?: "word" | "char";
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div";
  stagger?: number;
  delay?: number;
  duration?: number;
  className?: string;
  lineClassName?: string;
  /** Trigger on scroll instead of on mount. */
  onScroll?: boolean;
}

/**
 * Mask-up reveal for display type, animated entirely in CSS.
 *
 * The split happens during render — never imperatively after mount — so server
 * and client markup are identical. The intact string stays on the wrapper as
 * aria-label and every fragment is aria-hidden, otherwise a screen reader
 * announces a headline one letter at a time.
 */
export function SplitText({
  text,
  by = "word",
  as = "h2",
  stagger,
  delay = 0,
  duration = 0.9,
  className,
  lineClassName,
  onScroll = false,
}: SplitTextProps) {
  const { ref, visible } = useInView<HTMLElement>({
    threshold: 0.35,
    disabled: !onScroll,
  });

  const lines = Array.isArray(text) ? text : [text];
  const label = lines.join(" ");
  const Tag = as as keyof React.JSX.IntrinsicElements;
  const step = stagger ?? (by === "char" ? 0.014 : 0.045);

  // Flat index across all lines so the stagger reads as one continuous sweep.
  let unitIndex = 0;

  const style = {
    "--split-duration": `${duration * 1000}ms`,
    "--split-delay": `${delay * 1000}ms`,
    "--split-stagger": `${step * 1000}ms`,
  } as CSSProperties;

  return (
    // @ts-expect-error — dynamic tag with a ref; TS cannot narrow it.
    <Tag ref={ref} className={className} style={style} aria-label={label}>
      {lines.map((line, li) => {
        // Keep whitespace tokens so word spacing survives the split.
        const units = by === "char" ? Array.from(line) : line.split(/(\s+)/);

        return (
          <span
            key={li}
            className={cn("block overflow-hidden", visible && "is-visible", lineClassName)}
          >
            {units.map((unit, ui) => {
              if (/^\s+$/.test(unit)) {
                return (
                  <span key={ui} aria-hidden="true">
                    {unit}
                  </span>
                );
              }
              const i = unitIndex++;
              return (
                <span
                  key={ui}
                  aria-hidden="true"
                  className="js-split-unit"
                  style={{ "--i": i } as CSSProperties}
                >
                  {unit}
                </span>
              );
            })}
          </span>
        );
      })}
    </Tag>
  );
}

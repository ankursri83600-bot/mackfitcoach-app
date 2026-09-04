"use client";

import { useLenis } from "lenis/react";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface BeforeAfterSliderProps {
  before: { src: string; alt: string };
  after: { src: string; alt: string };
  /** Starting reveal position, 0–100. */
  initial?: number;
  label?: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

/**
 * Drag-to-compare transformation viewer.
 *
 * Several deliberate choices here:
 *  - `clip-path: inset()` rather than animating width. Width triggers layout on
 *    every pointer move; clip-path is composited.
 *  - The bounding rect is measured once on pointerdown, never in the move path.
 *  - `setPointerCapture` so a fast drag past the edge doesn't strand the handle.
 *  - Lenis is stopped during the drag, or a horizontal drag scrolls the page.
 *  - `touch-pan-y` keeps vertical page scrolling working on mobile while this
 *    element claims horizontal gestures.
 *  - Full `role="slider"` keyboard contract, so this works without a pointer.
 *
 * Both images render unclipped on the server, so with no JS a visitor still
 * sees the "after" photo with correct alt text.
 */
export function BeforeAfterSlider({
  before,
  after,
  initial = 50,
  label,
  className,
  sizes = "(max-width: 768px) 100vw, 40vw",
  priority,
}: BeforeAfterSliderProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const draggingRef = useRef(false);
  const [pct, setPct] = useState(initial);
  const lenis = useLenis();

  const setFromClientX = useCallback((clientX: number) => {
    const r = rectRef.current;
    if (!r || r.width === 0) return;
    const next = ((clientX - r.left) / r.width) * 100;
    setPct(Math.min(100, Math.max(0, next)));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = wrapRef.current;
      if (!el) return;
      rectRef.current = el.getBoundingClientRect();
      el.setPointerCapture(e.pointerId);
      draggingRef.current = true;
      lenis?.stop();
      setFromClientX(e.clientX);
    },
    [lenis, setFromClientX],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      setFromClientX(e.clientX);
    },
    [setFromClientX],
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      wrapRef.current?.releasePointerCapture?.(e.pointerId);
      rectRef.current = null;
      lenis?.start();
    },
    [lenis],
  );

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft") {
      setPct((p) => Math.max(0, p - step));
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      setPct((p) => Math.min(100, p + step));
      e.preventDefault();
    } else if (e.key === "Home") {
      setPct(0);
      e.preventDefault();
    } else if (e.key === "End") {
      setPct(100);
      e.preventDefault();
    }
  }, []);

  return (
    <figure
      ref={wrapRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        "relative aspect-[4/5] w-full touch-pan-y select-none overflow-hidden rounded-md bg-surface",
        className,
      )}
    >
      <Image
        src={after.src}
        alt={after.alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />

      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}>
        <Image
          src={before.src}
          alt={before.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      </div>

      {/* Corner tags so it's obvious which side is which. */}
      <span className="pointer-events-none absolute left-3 top-3 rounded-xs bg-ink/75 px-2 py-1 font-display text-[11px] tracking-[0.18em] text-bone backdrop-blur-sm">
        BEFORE
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-xs bg-blood/85 px-2 py-1 font-display text-[11px] tracking-[0.18em] text-bone backdrop-blur-sm">
        AFTER
      </span>

      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-blood"
        style={{ left: `${pct}%` }}
        aria-hidden="true"
      />

      <div
        role="slider"
        tabIndex={0}
        aria-label={`Reveal before and after${label ? ` — ${label}` : ""}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={`${Math.round(pct)}% before`}
        onKeyDown={onKeyDown}
        className="absolute top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-pill bg-blood text-bone shadow-[0_0_0_1px_rgba(245,243,241,0.25),0_8px_30px_-6px_rgba(196,38,43,0.7)]"
        style={{ left: `${pct}%` }}
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="currentColor">
          <path d="M9.5 7 5 12l4.5 5v-3.2h5V17l4.5-5-4.5-5v3.2h-5V7Z" />
        </svg>
      </div>

      {label ? (
        <figcaption className="pointer-events-none absolute bottom-3 left-3 right-3 text-caption text-bone/90">
          {label}
        </figcaption>
      ) : null}
    </figure>
  );
}

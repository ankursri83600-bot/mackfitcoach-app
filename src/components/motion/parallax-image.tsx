"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-in-view";

interface ParallaxImageProps {
  src: string;
  alt: string;
  /** Travel as a fraction of the container. Capped low to avoid motion sickness. */
  speed?: number;
  /** Overscale so the parallax travel never exposes an edge. */
  scale?: number;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  priority?: boolean;
  /** Dark scrim for text legibility over the image. */
  scrim?: boolean;
}

export function ParallaxImage({
  src,
  alt,
  speed = 0.14,
  scale = 1.18,
  className,
  imageClassName,
  sizes = "100vw",
  priority,
  scrim,
}: ParallaxImageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;

    const clamped = Math.min(0.2, Math.max(-0.2, speed));
    let raf = 0;
    let visible = true;

    // Only run the scroll maths while the element is actually on screen.
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { rootMargin: "100px" },
    );
    io.observe(wrap);

    const update = () => {
      raf = 0;
      if (!visible) return;
      const rect = wrap.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // -1 when just below the viewport, +1 when just above it.
      const progress = (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
      const shift = progress * clamped * 100;
      inner.style.transform = `translate3d(0, ${shift}%, 0) scale(${scale})`;
    };

    const onScroll = () => {
      // Coalesce to one write per frame; the handler itself never reads layout.
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduced, speed, scale]);

  return (
    <div ref={wrapRef} className={cn("relative overflow-hidden", className)}>
      <div
        ref={innerRef}
        className="absolute inset-0 will-change-transform"
        style={reduced ? undefined : { transform: `scale(${scale})` }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover", imageClassName)}
        />
      </div>
      {scrim ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-ink via-ink/45 to-ink/70"
        />
      ) : null}
    </div>
  );
}

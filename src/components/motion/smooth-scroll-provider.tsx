"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { usePrefersReducedMotion } from "./use-in-view";

/**
 * Lenis momentum scroll, in root mode so it animates the real window scroll
 * position. That keeps useScroll, IntersectionObserver, position:sticky and
 * anchor links all working — wrapper/virtual mode breaks every one of them.
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const reduce = usePrefersReducedMotion();

  // Reduced motion means NOT instantiating Lenis at all. A duration-0 instance
  // still runs a RAF loop every frame and still hijacks the scroll position.
  if (reduce) return <>{children}</>;

  return (
    <ReactLenis
      root
      options={{
        // lerp alone, no duration: they are alternative modes, and a 1s duration
        // makes every wheel tick feel like it is catching up with you. 0.14
        // still smooths but tracks the input closely.
        lerp: 0.14,
        wheelMultiplier: 1.05,
        smoothWheel: true,
        // Never smooth touch: it fights iOS rubber-banding and feels broken.
        syncTouch: false,
        touchMultiplier: 1.4,
        autoRaf: true,
        anchors: { offset: -88 },
      }}
    >
      <ScrollResetOnNavigate />
      {children}
    </ReactLenis>
  );
}

/**
 * The App Router writes window.scrollTo on navigation, but Lenis holds its own
 * target and animates straight back to where you were. Reset it explicitly.
 */
function ScrollResetOnNavigate() {
  const lenis = useLenis();
  const pathname = usePathname();

  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true });
  }, [pathname, lenis]);

  return null;
}

/**
 * Stop Lenis while a modal/drawer is open, or the page scrolls behind it.
 * Panels that scroll internally need `data-lenis-prevent` on the scroller.
 */
export function useLockScroll(locked: boolean) {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;
    if (locked) lenis.stop();
    else lenis.start();
    return () => lenis.start();
  }, [locked, lenis]);
}

"use client";

import { useEffect, useState } from "react";

/**
 * Gate for anything that reads browser-only state (matchMedia, sessionStorage,
 * pointer capabilities). Returns false during SSR and the first client render,
 * so server and client markup always agree.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** True only for real mice/trackpads. Touch never gets the custom cursor. */
export function useFinePointer() {
  const mounted = useMounted();
  const [fine, setFine] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    setFine(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setFine(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return mounted && fine;
}

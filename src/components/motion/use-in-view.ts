"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Single shared IntersectionObserver, keyed by threshold.
 *
 * One observer per element is what makes long pages jank on scroll; a 12-card
 * grid should not create 12 observers. Elements register with the observer that
 * matches their threshold and are unobserved as soon as they have fired.
 */
type Callback = (visible: boolean) => void;

const registries = new Map<string, { observer: IntersectionObserver; callbacks: Map<Element, Callback> }>();

function getRegistry(threshold: number, rootMargin: string) {
  const key = `${threshold}|${rootMargin}`;
  let registry = registries.get(key);
  if (registry) return registry;

  const callbacks = new Map<Element, Callback>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const callback = callbacks.get(entry.target);
        if (callback) callback(entry.isIntersecting);
      }
    },
    { threshold, rootMargin },
  );

  registry = { observer, callbacks };
  registries.set(key, registry);
  return registry;
}

export interface InViewOptions {
  threshold?: number;
  rootMargin?: string;
  /** Stop observing after the first time it becomes visible. */
  once?: boolean;
  /** Skip observation entirely and report visible immediately. */
  disabled?: boolean;
}

export function useInView<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.2,
  rootMargin = "0px 0px -10% 0px",
  once = true,
  disabled = false,
}: InViewOptions = {}) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (disabled) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const { observer, callbacks } = getRegistry(threshold, rootMargin);

    const handler: Callback = (isVisible) => {
      if (isVisible) {
        setVisible(true);
        if (once) {
          callbacks.delete(el);
          observer.unobserve(el);
        }
      } else if (!once) {
        setVisible(false);
      }
    };

    callbacks.set(el, handler);
    observer.observe(el);

    return () => {
      callbacks.delete(el);
      observer.unobserve(el);
    };
  }, [threshold, rootMargin, once, disabled]);

  return { ref, visible };
}

/** Matches the OS reduced-motion setting, SSR-safe. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

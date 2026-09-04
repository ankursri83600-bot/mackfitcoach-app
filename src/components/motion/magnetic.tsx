"use client";

import Link from "next/link";
import { useCallback, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useFinePointer } from "./use-mounted";
import { usePrefersReducedMotion } from "./use-in-view";

interface MagneticProps {
  children: ReactNode;
  /** 0..1 — how far the element chases the pointer. */
  strength?: number;
  className?: string;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  "aria-label"?: string;
}

/**
 * Pointer-chasing button.
 *
 * Written against the DOM directly rather than through an animation library:
 * the transform is written inside a rAF, and the spring-back on leave is a CSS
 * transition. The transform lives on an inner span so the focus ring — which
 * sits on the real interactive element — never drifts from where keyboard users
 * expect it.
 */
export function MagneticButton({
  children,
  strength = 0.35,
  className,
  href,
  onClick,
  type = "button",
  disabled,
  ...rest
}: MagneticProps) {
  const reduced = usePrefersReducedMotion();
  const fine = useFinePointer();
  const enabled = !reduced && fine && !disabled;

  const innerRef = useRef<HTMLSpanElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef(0);

  // Measured once per hover. Reading getBoundingClientRect on every pointermove
  // is the classic layout thrash.
  const onEnter = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      rectRef.current = e.currentTarget.getBoundingClientRect();
      if (innerRef.current) innerRef.current.style.transition = "none";
    },
    [enabled],
  );

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const rect = rectRef.current;
      if (!enabled || !rect) return;

      const dx = (e.clientX - (rect.left + rect.width / 2)) * strength;
      const dy = (e.clientY - (rect.top + rect.height / 2)) * strength;

      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (innerRef.current) {
          innerRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        }
      });
    },
    [enabled, strength],
  );

  const onLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rectRef.current = null;
    const node = innerRef.current;
    if (!node) return;
    node.style.transition = "transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)";
    node.style.transform = "translate3d(0, 0, 0)";
  }, []);

  const inner = (
    <span ref={innerRef} className="inline-flex items-center gap-2">
      {children}
    </span>
  );

  const handlers = {
    onPointerEnter: onEnter,
    onPointerMove: onMove,
    onPointerLeave: onLeave,
  };

  if (href) {
    return (
      <Link href={href} className={cn(className)} {...handlers} {...rest}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(className)}
      {...handlers}
      {...rest}
    >
      {inner}
    </button>
  );
}

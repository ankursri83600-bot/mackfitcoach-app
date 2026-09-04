"use client";

import { Children, cloneElement, isValidElement, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useInView } from "./use-in-view";

type Direction = "up" | "down" | "left" | "right" | "none";

function offsetVars(dir: Direction, distance: number): CSSProperties {
  switch (dir) {
    case "up":
      return { "--reveal-y": `${distance}px` } as CSSProperties;
    case "down":
      return { "--reveal-y": `${-distance}px` } as CSSProperties;
    case "left":
      return { "--reveal-x": `${distance}px`, "--reveal-y": "0px" } as CSSProperties;
    case "right":
      return { "--reveal-x": `${-distance}px`, "--reveal-y": "0px" } as CSSProperties;
    default:
      return { "--reveal-x": "0px", "--reveal-y": "0px" } as CSSProperties;
  }
}

type Tag = "div" | "section" | "ul" | "li" | "span";

/**
 * Explicit render branches per tag.
 *
 * Rendering a dynamic `<Tag>` with a ref makes TypeScript union every possible
 * intrinsic element's props together, which trips TS2590 ("union type that is
 * too complex to represent"). Five small branches keep it fully typed.
 */
function Tagged({
  as,
  refCb,
  className,
  style,
  children,
}: {
  as: Tag;
  refCb: React.Ref<HTMLElement>;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const shared = { className, style, children };
  switch (as) {
    case "section":
      return <section ref={refCb as React.Ref<HTMLElement>} {...shared} />;
    case "ul":
      return <ul ref={refCb as React.Ref<HTMLUListElement>} {...shared} />;
    case "li":
      return <li ref={refCb as React.Ref<HTMLLIElement>} {...shared} />;
    case "span":
      return <span ref={refCb as React.Ref<HTMLSpanElement>} {...shared} />;
    default:
      return <div ref={refCb as React.Ref<HTMLDivElement>} {...shared} />;
  }
}

interface RevealProps {
  children: ReactNode;
  dir?: Direction;
  distance?: number;
  /** Seconds, to match the previous API. */
  delay?: number;
  duration?: number;
  amount?: number;
  /** Seconds between children; children must be <RevealItem>. */
  stagger?: number;
  className?: string;
  as?: Tag;
}

/**
 * Scroll-triggered entrance. Transform + opacity only, driven entirely by CSS —
 * this component's whole job is to add `is-visible` when the element scrolls in.
 */
export function Reveal({
  children,
  dir = "up",
  distance = 28,
  delay = 0,
  duration = 0.7,
  amount = 0.2,
  stagger,
  className,
  as = "div",
}: RevealProps) {
  const { ref, visible } = useInView<HTMLElement>({ threshold: amount });

  const style = {
    ...offsetVars(dir, distance),
    "--reveal-duration": `${duration * 1000}ms`,
    "--reveal-delay": `${delay * 1000}ms`,
    ...(stagger ? ({ "--stagger": `${stagger * 1000}ms` } as CSSProperties) : {}),
  } as CSSProperties;

  // With a stagger, the parent stays visible and each child animates itself —
  // the index is injected here so callers don't have to number them by hand.
  const content = stagger
    ? Children.map(children, (child, i) =>
        isValidElement<ItemProps>(child)
          ? cloneElement(child, { index: child.props.index ?? i })
          : child,
      )
    : children;

  return (
    <Tagged
      as={as}
      refCb={ref}
      style={style}
      className={cn(
        stagger ? undefined : "js-reveal",
        !stagger && visible && "is-visible",
        className,
      )}
    >
      {content}
    </Tagged>
  );
}

interface ItemProps {
  children: ReactNode;
  dir?: Direction;
  distance?: number;
  duration?: number;
  className?: string;
  as?: "div" | "li" | "span";
  /** Position in the stagger sequence. Set automatically when omitted. */
  index?: number;
}

/**
 * Child of a staggered Reveal.
 *
 * Each item observes itself but inherits the parent's stagger step, so the
 * sequence reads as one sweep while still only animating what is on screen.
 */
export function RevealItem({
  children,
  dir = "up",
  distance = 22,
  duration = 0.6,
  className,
  as = "div",
  index,
}: ItemProps) {
  const { ref, visible } = useInView<HTMLElement>({ threshold: 0.15 });

  const style = {
    ...offsetVars(dir, distance),
    "--reveal-duration": `${duration * 1000}ms`,
    ...(index !== undefined
      ? ({ "--reveal-delay": `${index * 80}ms` } as CSSProperties)
      : {}),
  } as CSSProperties;

  return (
    <Tagged
      as={as}
      refCb={ref}
      style={style}
      className={cn("js-reveal", visible && "is-visible", className)}
    >
      {children}
    </Tagged>
  );
}

/** Animates on mount rather than on scroll — for above-the-fold hero copy. */
export function FadeUp({
  children,
  delay = 0,
  duration = 0.8,
  distance = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  distance?: number;
  className?: string;
}) {
  // `disabled` reports visible immediately, so the transition runs on mount.
  const { ref, visible } = useInView<HTMLDivElement>({ disabled: true });

  const style = {
    "--reveal-y": `${distance}px`,
    "--reveal-duration": `${duration * 1000}ms`,
    "--reveal-delay": `${delay * 1000}ms`,
  } as CSSProperties;

  return (
    <div ref={ref} style={style} className={cn("js-reveal", visible && "is-visible", className)}>
      {children}
    </div>
  );
}

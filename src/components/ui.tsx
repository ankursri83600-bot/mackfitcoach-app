import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Page-width container. */
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[--container-page] px-(--spacing-gutter)", className)}>
      {children}
    </div>
  );
}

export function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-20 md:py-28 lg:py-32", className)}>
      {children}
    </section>
  );
}

/** Small uppercase label with a red rule, used above section headings. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-3 font-display text-[0.7rem] tracking-[0.32em] text-muted",
        className,
      )}
    >
      <span aria-hidden="true" className="h-px w-8 bg-blood" />
      {children}
    </span>
  );
}

type ButtonVariant = "blood" | "solid" | "outline" | "ghost";

/**
 * On the dark theme every filled button took `text-ink`, because ink was the
 * bone white. Inverted, that same class paints near-black text on a red fill —
 * so the filled variants now say `text-canvas` explicitly.
 */
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Gradient fill plus a glow in its own hue — the reference's signature.
  // `grad-animate` drifts the gradient so a filled button is never static.
  blood: "grad-blood grad-animate text-white shadow-accent hover:shadow-e3",
  solid: "grad-dark grad-animate text-white shadow-e2 hover:shadow-e3",
  outline:
    "border border-hairline-hi bg-surface text-ink shadow-e1 hover:border-transparent hover:text-blood hover:shadow-e2",
  ghost: "text-ink hover:bg-surface-2 hover:text-blood",
};

/**
 * The lift is 1px and only on hover. Filled buttons on paper need SOME
 * elevation cue to read as pressable — on black the colour alone did it.
 * `active:` returns it to the surface so the click has a physical bottom.
 */
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-pill px-7 py-3.5 font-display text-[0.82rem] tracking-[0.16em] uppercase " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out-quart " +
  "hover:-translate-y-px active:translate-y-0 active:duration-75 " +
  "disabled:pointer-events-none disabled:opacity-50 motion-reduce:hover:translate-y-0";

export function Button({
  children,
  variant = "blood",
  className,
  type = "button",
  ...rest
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  type?: "button" | "submit" | "reset";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = "blood",
  className,
}: {
  children: ReactNode;
  href: string;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], className)}
    >
      {children}
    </Link>
  );
}

export function Card({
  children,
  className,
  interactive,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        // Borderless and floating: Soft UI cards are pure white on a grey page,
        // separated by shadow alone. A visible border here is the single
        // fastest way to lose the look.
        "rounded-lg bg-surface p-6 shadow-e2",
        interactive &&
          "transition-[box-shadow,transform] duration-300 ease-out-quart " +
            "hover:-translate-y-1.5 hover:shadow-e3 motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "blood" | "good" | "warn";
  className?: string;
}) {
  // Each tone is a wash of its own colour with the DEEP shade as text. The
  // dark theme could use the bright shade because it sat on near-black; at 10%
  // tint on paper the bright shades all fall under 3:1.
  const tones = {
    neutral: "border-hairline-hi bg-surface-2 text-muted",
    blood: "border-blood/30 bg-blood-tint text-blood-deep",
    good: "border-good/30 bg-good/10 text-good",
    warn: "border-warn/30 bg-warn/10 text-warn",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border px-3 py-1 font-display text-[0.65rem] tracking-[0.2em] uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Thin full-bleed divider. */
export function Rule({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("h-px w-full bg-hairline", className)} />;
}

/**
 * The health disclaimer. Legally and ethically load-bearing: this appears on
 * the intake form, every generated plan, and the print output.
 */
export function HealthDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-caption leading-relaxed text-muted-dim", className)}>
      <strong className="text-muted">Not medical advice.</strong> This plan is generated
      automatically from the details you entered and is intended for general fitness guidance
      only. It is not a substitute for professional medical or dietetic care. Consult a doctor
      before starting any diet if you are pregnant or breastfeeding, are under 18, or have a
      medical condition such as diabetes, thyroid disorder, kidney disease, or an eating disorder.
    </p>
  );
}

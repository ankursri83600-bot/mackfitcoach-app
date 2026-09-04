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
        "inline-flex items-center gap-3 font-display text-[0.7rem] tracking-[0.32em] text-ash",
        className,
      )}
    >
      <span aria-hidden="true" className="h-px w-8 bg-blood" />
      {children}
    </span>
  );
}

type ButtonVariant = "blood" | "bone" | "outline" | "ghost";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  blood: "bg-blood text-bone hover:bg-blood-bright",
  bone: "bg-bone text-ink hover:bg-white",
  outline: "border border-hairline-hi text-bone hover:border-blood hover:text-blood-bright",
  ghost: "text-bone hover:text-blood-bright",
};

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-pill px-7 py-3.5 font-display text-[0.82rem] tracking-[0.16em] uppercase transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50";

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
        "rounded-lg border border-hairline bg-surface p-6",
        interactive && "transition-colors duration-300 hover:border-blood/50 hover:bg-surface-2",
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
  const tones = {
    neutral: "border-hairline-hi text-ash",
    blood: "border-blood/60 bg-blood/10 text-blood-bright",
    good: "border-good/50 bg-good/10 text-good",
    warn: "border-warn/50 bg-warn/10 text-warn",
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
    <p className={cn("text-caption leading-relaxed text-ash-dim", className)}>
      <strong className="text-ash">Not medical advice.</strong> This plan is generated
      automatically from the details you entered and is intended for general fitness guidance
      only. It is not a substitute for professional medical or dietetic care. Consult a doctor
      before starting any diet if you are pregnant or breastfeeding, are under 18, or have a
      medical condition such as diabetes, thyroid disorder, kidney disease, or an eating disorder.
    </p>
  );
}

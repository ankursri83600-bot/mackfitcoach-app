import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils";

const { lead, accent, sub } = siteConfig.nameParts;

/**
 * The badge's brush lettering is illegible below roughly 120px, so anywhere
 * small the wordmark is rendered as live text in the display face rather than
 * shrinking the artwork. Variants:
 *
 *  badge     — artwork only (hero ghosts, print headers, avatars)
 *  lockup    — badge + horizontal wordmark (site header)
 *  stacked   — badge above a centred wordmark (footer, preloader)
 *  wordmark  — live text only, no artwork (dense UI, print)
 */
export type LogoVariant = "badge" | "lockup" | "stacked" | "wordmark";

interface WordmarkProps {
  /** Tailwind text-size class driving the whole wordmark. */
  className?: string;
  subClassName?: string;
}

export function Wordmark({ className, subClassName }: WordmarkProps) {
  return (
    <span className={cn("flex flex-col leading-none", className)}>
      <span className="font-display tracking-[-0.02em]">
        <span className="text-bone">{lead}</span>
        <span className="text-blood">{accent}</span>
      </span>
      <span
        className={cn(
          "font-display text-[0.36em] leading-none tracking-[0.34em] text-bone/85",
          subClassName,
        )}
      >
        {sub}
      </span>
    </span>
  );
}

interface BadgeProps {
  size?: number;
  className?: string;
  priority?: boolean;
  /** Decorative uses (hero ghost) should not announce themselves. */
  decorative?: boolean;
}

export function LogoBadge({ size = 44, className, priority, decorative }: BadgeProps) {
  // Serve the nearest generated size up rather than downscaling the 1024 master.
  //
  // Decorative uses are deliberately capped at the 256px source: the hero ghost
  // renders at 720px but sits at ~5% opacity, so the 996KB master it would
  // otherwise pull is a megabyte spent on something nobody can resolve.
  const src = decorative
    ? "/brand/logo-badge-256.png"
    : size <= 64
      ? "/brand/logo-badge-128.png"
      : size <= 128
        ? "/brand/logo-badge-256.png"
        : "/brand/logo-badge-512.png";

  return (
    <Image
      src={src}
      alt={decorative ? "" : `${siteConfig.name} badge`}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      quality={decorative ? 45 : 80}
      sizes={`${size}px`}
      className={cn("select-none", className)}
    />
  );
}

interface LogoProps {
  variant?: LogoVariant;
  /** Badge pixel size; the wordmark scales from it. */
  size?: number;
  href?: string | null;
  className?: string;
  priority?: boolean;
}

export function Logo({
  variant = "lockup",
  size = 44,
  href = "/",
  className,
  priority,
}: LogoProps) {
  const content =
    variant === "badge" ? (
      <LogoBadge size={size} priority={priority} />
    ) : variant === "wordmark" ? (
      <Wordmark className="text-[1.35rem]" />
    ) : variant === "stacked" ? (
      <span className="flex flex-col items-center gap-3">
        <LogoBadge size={size} priority={priority} />
        <Wordmark className="items-center text-[1.5rem]" />
      </span>
    ) : (
      <span className="flex items-center gap-2.5">
        <LogoBadge size={size} priority={priority} />
        <Wordmark className="text-[1.3rem]" />
      </span>
    );

  const base = cn("inline-flex shrink-0 items-center", className);

  if (href === null) {
    return <span className={base}>{content}</span>;
  }

  return (
    <Link
      href={href}
      className={cn(base, "transition-opacity duration-200 hover:opacity-80")}
      aria-label={`${siteConfig.name} — home`}
    >
      {content}
    </Link>
  );
}

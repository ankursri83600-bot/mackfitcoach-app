"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const controlStyles =
  "w-full rounded-sm border border-hairline-hi bg-surface px-4 py-3 text-bone outline-none transition-colors placeholder:text-ash-dim focus:border-blood disabled:opacity-50";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-caption text-ash">
        {label}
        {required ? <span className="text-blood"> *</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-[0.7rem] text-ash-dim">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-[0.7rem] text-blood-bright">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlStyles, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlStyles, "min-h-24", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlStyles, props.className)} />;
}

export function FormAlert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
}) {
  const tones = {
    error: "border-blood/50 bg-blood/10 text-blood-bright",
    success: "border-good/50 bg-good/10 text-good",
    info: "border-hairline-hi bg-surface-2 text-ash",
  } as const;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      className={cn("rounded-sm border px-4 py-3 text-caption", tones[tone])}
    >
      {children}
    </div>
  );
}

/** Shown wherever a feature needs Supabase but it is not configured. */
export function SupabaseNotice() {
  return (
    <FormAlert tone="info">
      <strong className="text-bone">Accounts are not connected yet.</strong> Add your Supabase
      keys to <code className="text-bone">.env.local</code> to enable sign-in. Everything else on
      the site — including the diet chart — works without them.
    </FormAlert>
  );
}

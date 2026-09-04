"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight, Check, RotateCcw, X } from "lucide-react";

import type { SwapCandidate } from "@/lib/diet/swap";
import { cn } from "@/lib/utils";

import { getSwapOptions, removeSwap, saveSwap } from "@/app/diet/[planId]/swap-actions";

/**
 * Swap control for one plan item.
 *
 * Options are fetched on OPEN, not on mount. A 7-day plan has roughly 80
 * items; prefetching every option list would mean 80 server round-trips and
 * shipping most of the food table to the browser for a control almost nobody
 * touches.
 */
export function SwapItem({
  planId,
  dayIndex,
  slotId,
  itemIndex,
  isSwapped,
}: {
  planId: string;
  dayIndex: number;
  slotId: string;
  /**
   * Position within the meal, NOT the food id.
   *
   * Once swapped, the id on screen is the substitute while the stored row is
   * keyed on the original food — so sending the visible id back would create a
   * second override rather than replacing the first. The server resolves the
   * original from this index.
   */
  itemIndex: number;
  /** True when this item is already the RESULT of a swap. */
  isSwapped?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SwapCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (options) return;

    setError(null);
    const res = await getSwapOptions(planId, dayIndex, slotId, itemIndex);
    if (res.error) setError(res.error);
    setOptions(res.options);
  }

  function choose(toFoodId: string) {
    startTransition(async () => {
      const res = await saveSwap(planId, dayIndex, slotId, itemIndex, toFoodId);
      if (res.error) setError(res.error);
      else setOpen(false);
    });
  }

  function revert() {
    startTransition(async () => {
      const res = await removeSwap(planId, dayIndex, slotId, itemIndex);
      if (res.error) setError(res.error);
      else setOpen(false);
    });
  }

  return (
    <span className="relative inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? "Close substitutes" : "Swap this item"}
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-pill transition-colors",
          open ? "grad-blood text-white" : "text-muted-dim hover:bg-surface-2 hover:text-blood",
        )}
      >
        {open ? <X className="size-3" /> : <ArrowLeftRight className="size-3" />}
      </button>

      {isSwapped ? (
        <span className="rounded-pill bg-ocean-tint px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.1em] text-ocean-deep">
          swapped
        </span>
      ) : null}

      {open ? (
        <div
          className="absolute left-0 top-8 z-30 w-72 rounded-md bg-surface p-3 shadow-e3"
          role="dialog"
          aria-label="Choose a substitute"
        >
          <p className="text-[0.62rem] uppercase tracking-[0.14em] text-muted-dim">
            Swap for something with the same job
          </p>

          {error ? (
            <p role="alert" className="mt-2 rounded-sm bg-blood-tint px-2 py-1.5 text-[0.7rem] text-blood-deep">
              {error}
            </p>
          ) : null}

          {options === null && !error ? (
            <p className="mt-3 text-caption text-muted">Finding options…</p>
          ) : null}

          {options?.length === 0 && !error ? (
            <p className="mt-3 text-caption text-muted">
              Nothing else in your food list fits this slot at these calories.
            </p>
          ) : null}

          {options && options.length > 0 ? (
            <ul className="mt-2 max-h-64 space-y-0.5 overflow-y-auto" data-lenis-prevent>
              {options.map((o) => (
                <li key={o.foodId}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => choose(o.foodId)}
                    className="flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-caption text-ink">{o.name}</span>
                      <span className="block text-[0.65rem] text-muted">{o.measure}</span>
                    </span>
                    <span className="shrink-0 text-right font-mono text-[0.65rem] tabular-nums">
                      <span className="block text-muted">{o.kcal} kcal</span>
                      {/* Protein delta is what a reader actually checks when
                          substituting, so it gets the colour. */}
                      <span
                        className={cn(
                          "block",
                          o.deltaProtein > 0.4
                            ? "text-leaf-deep"
                            : o.deltaProtein < -0.4
                              ? "text-ember-deep"
                              : "text-muted-dim",
                        )}
                      >
                        {o.deltaProtein > 0 ? "+" : ""}
                        {o.deltaProtein}g P
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {isSwapped ? (
            <button
              type="button"
              onClick={revert}
              disabled={pending}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-sm border border-hairline-hi px-2 py-1.5 text-[0.7rem] text-muted transition-colors hover:text-blood disabled:opacity-50"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              Restore the original
            </button>
          ) : null}

          {pending ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[0.7rem] text-muted">
              <Check className="size-3" aria-hidden="true" />
              Saving…
            </p>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}

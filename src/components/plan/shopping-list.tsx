"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ShoppingBasket } from "lucide-react";

import { buildShoppingList, shoppingListText } from "@/lib/diet/shopping";
import type { DietPlan } from "@/lib/diet/types";
import { cn } from "@/lib/utils";

/**
 * Week's shopping list, derived from the plan.
 *
 * Ticking is intentionally EPHEMERAL — component state, not persisted. A
 * shopping list is used once, in a shop, on one device; syncing it would mean
 * a row per tick and a stale list greeting you next week. Refreshing clears it,
 * which is the correct behaviour for a list you have already bought.
 */
export function ShoppingListPanel({ plan, locked }: { plan: DietPlan; locked?: boolean }) {
  const list = useMemo(() => buildShoppingList(plan), [plan]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  function toggle(id: string) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shoppingListText(list, "MackFitCoach — week's shopping"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked in some in-app browsers. Say nothing and leave
      // the button alone rather than throwing a scary error at a shopper.
    }
  }

  if (locked) {
    return (
      <div className="rounded-lg bg-surface p-6 shadow-e2">
        <h2 className="flex items-center gap-2 font-display text-h4 text-ink">
          <ShoppingBasket className="size-5 text-blood" aria-hidden="true" />
          Shopping list
        </h2>
        <p className="mt-3 text-caption text-muted">
          Unlock the full week to get one consolidated list — every ingredient across all seven
          days, totalled, grouped by aisle.
        </p>
      </div>
    );
  }

  const done = ticked.size;

  return (
    <div className="rounded-lg bg-surface p-6 shadow-e2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-h4 text-ink">
            <ShoppingBasket className="size-5 text-blood" aria-hidden="true" />
            Shopping list
          </h2>
          <p className="mt-1 text-caption text-muted tabular-nums">
            {list.totalItems} items for the week
            {done > 0 ? ` · ${done} ticked` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-2 rounded-pill border border-hairline-hi bg-surface px-4 py-2 text-caption text-ink shadow-e1 transition-[box-shadow,color] hover:text-blood hover:shadow-e2"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-leaf-deep" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" aria-hidden="true" />
              Copy as text
            </>
          )}
        </button>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {list.byCategory.map((group) => (
          <div key={group.category}>
            <h3 className="text-[0.66rem] uppercase tracking-[0.16em] text-muted-dim">
              {group.label}
            </h3>
            <ul className="mt-2 space-y-1">
              {group.lines.map((line) => {
                const isTicked = ticked.has(line.foodId);
                return (
                  <li key={line.foodId}>
                    <button
                      type="button"
                      onClick={() => toggle(line.foodId)}
                      aria-pressed={isTicked}
                      className="flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded-xs border transition-colors",
                          isTicked
                            ? "border-transparent grad-success text-white"
                            : "border-hairline-hi",
                        )}
                      >
                        {isTicked ? <Check className="size-3" /> : null}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-caption",
                          isTicked ? "text-muted-dim line-through" : "text-ink",
                        )}
                      >
                        {line.name}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-[0.7rem] tabular-nums",
                          isTicked ? "text-muted-dim" : "text-muted",
                        )}
                      >
                        {line.display}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-6 text-[0.62rem] leading-relaxed text-muted-dim">
        Quantities are the exact sum of what the plan asks you to eat, not rounded to pack sizes.
        Ticks are not saved — this list is for one trip.
      </p>
    </div>
  );
}

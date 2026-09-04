"use client";

import { bmiCategoryAsian } from "@/lib/diet/metrics";
import type { BmiCategoryAsian } from "@/lib/diet/types";
import { cn } from "@/lib/utils";

const CATEGORY_COLOR: Record<BmiCategoryAsian, string> = {
  underweight: "#4f8ff7",
  normal: "#3fb950",
  overweight: "#d29922",
  obese: "#c4262b",
};

const CATEGORY_LABEL: Record<BmiCategoryAsian, string> = {
  underweight: "Underweight",
  normal: "Healthy range",
  overweight: "Overweight",
  obese: "Obese range",
};

const MIN_BMI = 14;
const MAX_BMI = 40;
const RADIUS = 84;
const CIRCUMFERENCE = Math.PI * RADIUS; // semicircle

/**
 * Live half-donut BMI readout for the intake wizard.
 *
 * Imports `bmiCategoryAsian` from the same lib/diet/metrics module the plan
 * generator uses, so this preview can never disagree with the plan generated a
 * step later. The sweep is a CSS transition on stroke-dashoffset.
 */
export function BmiGauge({ bmi, className }: { bmi: number | null; className?: string }) {
  const clamped = bmi === null ? MIN_BMI : Math.min(MAX_BMI, Math.max(MIN_BMI, bmi));
  const fraction = (clamped - MIN_BMI) / (MAX_BMI - MIN_BMI);
  const category = bmi === null ? null : bmiCategoryAsian(bmi);
  const color = category ? CATEGORY_COLOR[category] : "#5d5d64";
  const offset = CIRCUMFERENCE * (1 - fraction);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg
        viewBox="0 0 200 110"
        className="w-full max-w-[220px]"
        role="img"
        aria-label={bmi === null ? "BMI not yet known" : `BMI ${bmi.toFixed(1)}`}
      >
        <path
          d="M 16 100 A 84 84 0 0 1 184 100"
          fill="none"
          stroke="var(--color-hairline-hi)"
          strokeWidth={14}
          strokeLinecap="round"
        />
        <path
          d="M 16 100 A 84 84 0 0 1 184 100"
          fill="none"
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{
            transition:
              "stroke-dashoffset 520ms var(--ease-out-expo), stroke 320ms linear",
          }}
        />
      </svg>

      <div className="-mt-10 flex flex-col items-center">
        <span className="font-display text-h3 tabular-nums text-bone">
          {bmi === null ? "—" : bmi.toFixed(1)}
        </span>
        <span className="text-caption text-ash">BMI</span>
        {category ? (
          <span
            className="mt-2 rounded-pill border px-3 py-1 font-display text-[0.65rem] tracking-[0.16em] uppercase"
            style={{ borderColor: `${color}80`, color, backgroundColor: `${color}1a` }}
          >
            {CATEGORY_LABEL[category]}
          </span>
        ) : null}
      </div>

      <p className="mt-3 max-w-[220px] text-center text-[0.7rem] leading-relaxed text-ash-dim">
        Based on the Asian-Indian BMI scale, where overweight begins at 23.
      </p>
    </div>
  );
}

const COLORS = { protein: "#c4262b", carbs: "#8a8a90", fat: "#f5f3f1" } as const;

interface MacroRingProps {
  proteinG: number;
  carbsG: number;
  fatG: number;
  size?: number;
}

/** Simple SVG macro-split ring. No chart dependency needed for three arcs. */
export function MacroRing({ proteinG, carbsG, fatG, size = 160 }: MacroRingProps) {
  const proteinKcal = proteinG * 4;
  const carbsKcal = carbsG * 4;
  const fatKcal = fatG * 9;
  const total = proteinKcal + carbsKcal + fatKcal || 1;

  const r = 70;
  const circumference = 2 * Math.PI * r;
  const segments = [
    { label: "Protein", kcal: proteinKcal, color: COLORS.protein },
    { label: "Carbs", kcal: carbsKcal, color: COLORS.carbs },
    { label: "Fat", kcal: fatKcal, color: COLORS.fat },
  ];

  let offset = 0;
  const arcs = segments.map((s) => {
    const length = (s.kcal / total) * circumference;
    const arc = { ...s, length, offset };
    offset += length;
    return arc;
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" width={size} height={size} className="-rotate-90">
        <circle cx={80} cy={80} r={r} fill="none" stroke="var(--color-hairline)" strokeWidth={16} />
        {arcs.map((a) => (
          <circle
            key={a.label}
            cx={80}
            cy={80}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={16}
            strokeDasharray={`${a.length} ${circumference - a.length}`}
            strokeDashoffset={-a.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <ul className="space-y-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-caption text-ash">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
            <span className="font-mono tabular-nums text-bone">
              {s.label === "Protein" ? proteinG : s.label === "Carbs" ? carbsG : fatG}g
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

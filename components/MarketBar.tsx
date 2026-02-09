"use client";

import { useMemo } from "react";

function baseToFloat(baseUnits: string): number {
  const n = Number(baseUnits);
  if (!Number.isFinite(n)) return 0;
  return n / 1e18;
}

function formatCompactAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 0.01) return "<0.01";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 100) return `${n.toFixed(0)}`;
  return n.toFixed(2);
}

export function MarketBar({
  totalForBaseUnits,
  totalAgainstBaseUnits,
  compact = true,
}: {
  totalForBaseUnits: string;
  totalAgainstBaseUnits: string;
  compact?: boolean;
}) {
  const { forAmt, againstAmt, forPct } = useMemo(() => {
    const forAmt = baseToFloat(totalForBaseUnits);
    const againstAmt = baseToFloat(totalAgainstBaseUnits);
    const total = forAmt + againstAmt;
    const forPct = total > 0 ? Math.round((forAmt / total) * 100) : 50;
    return { forAmt, againstAmt, forPct };
  }, [totalAgainstBaseUnits, totalForBaseUnits]);

  const forLabel = formatCompactAmount(forAmt);
  const againstLabel = formatCompactAmount(againstAmt);

  return (
    <div
      className={`rounded-2xl bg-zinc-50 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
        <div>For vs Against</div>
        <div className="tabular-nums">{forPct}% For</div>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-rose-200/70 dark:bg-rose-950/60">
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${forPct}%` }}
          aria-hidden="true"
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            For
          </div>
          <div className="mt-0.5 font-extrabold text-zinc-900 dark:text-zinc-50 tabular-nums">
            {forLabel}
          </div>
        </div>
        <div className="min-w-0 text-right">
          <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
            Against
          </div>
          <div className="mt-0.5 font-extrabold text-zinc-900 dark:text-zinc-50 tabular-nums">
            {againstLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

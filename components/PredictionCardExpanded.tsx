"use client";

import { useMemo } from "react";

type ExpandedPrediction = {
  id: number;
  creatorUserId: number;
  assetSymbol: string;
  direction: "up" | "down";
  timeframeEnd: number;
  confidence: number;
  status: string;
  createdAt: string;
  stakeSummary: {
    totalFor: string;
    totalAgainst: string;
    stakeCount: number;
  };
};

function handleFromCreatorId(creatorUserId: number): string {
  return `signal${creatorUserId}`;
}

function avatarBgFromId(id: number): string {
  const hues = [25, 190, 280, 140, 330, 210, 70];
  const hue = hues[id % hues.length];
  return `hsl(${hue} 70% 45%)`;
}

function formatEnds(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString();
}

function formatCompactWLD(baseUnits: string): string {
  const wld = Number(baseUnits) / 1e18;
  if (!Number.isFinite(wld)) return "0";
  if (wld >= 1000) return `${(wld / 1000).toFixed(1)}k`;
  if (wld >= 100) return `${wld.toFixed(0)}`;
  return wld.toFixed(2);
}

export function PredictionCardExpanded({
  prediction,
  onBet,
}: {
  prediction: ExpandedPrediction;
  onBet?: () => void;
}) {
  const creatorHandle = useMemo(
    () => handleFromCreatorId(prediction.creatorUserId),
    [prediction.creatorUserId]
  );

  const totalFor = Number(prediction.stakeSummary.totalFor);
  const totalAgainst = Number(prediction.stakeSummary.totalAgainst);
  const total = totalFor + totalAgainst;
  const forPct = total > 0 ? Math.round((totalFor / total) * 100) : 50;

  const directionLabel = prediction.direction === "up" ? "UP" : "DOWN";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="flex items-start gap-3">
        <div
          className="h-11 w-11 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/10"
          style={{ background: avatarBgFromId(prediction.creatorUserId) }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                @{creatorHandle}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Posted {new Date(prediction.createdAt).toLocaleDateString()}
              </div>
            </div>

            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-200 dark:ring-zinc-800">
              {prediction.confidence}% conf
            </span>
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                {prediction.assetSymbol}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${
                  prediction.direction === "up"
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900"
                    : "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-900"
                }`}
              >
                {directionLabel}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                ends {formatEnds(prediction.timeframeEnd)}
              </span>
            </div>

            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Status:{" "}
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {prediction.status}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
            <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
              <div className="font-semibold">For vs Against</div>
              <div>{forPct}% For</div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-rose-200/70 dark:bg-rose-950/60">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${forPct}%` }}
                aria-hidden="true"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
                <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  For
                </div>
                <div className="mt-0.5 text-sm font-extrabold text-zinc-900 dark:text-zinc-50">
                  {formatCompactWLD(prediction.stakeSummary.totalFor)} WLD
                </div>
              </div>
              <div className="rounded-xl bg-white p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
                <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                  Against
                </div>
                <div className="mt-0.5 text-sm font-extrabold text-zinc-900 dark:text-zinc-50">
                  {formatCompactWLD(prediction.stakeSummary.totalAgainst)} WLD
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onBet}
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.99] dark:bg-zinc-50 dark:text-zinc-950"
          >
            Bet
          </button>
        </div>
      </div>
    </section>
  );
}


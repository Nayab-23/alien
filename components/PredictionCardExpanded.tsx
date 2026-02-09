"use client";

import { useMemo } from "react";
import { MarketBar } from "@/components/MarketBar";

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

function formatTimeLeft(unixSeconds: number): string {
  const msLeft = unixSeconds * 1000 - Date.now();
  if (msLeft <= 0) return "ended";
  const minutes = Math.floor(msLeft / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
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

  const timeLeft = useMemo(
    () => formatTimeLeft(prediction.timeframeEnd),
    [prediction.timeframeEnd]
  );

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
          {/* Creator row */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                @{creatorHandle}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Posted {new Date(prediction.createdAt).toLocaleDateString()}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-200 dark:ring-zinc-800">
                {prediction.confidence}% conf
              </span>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-300 dark:ring-zinc-800">
                {timeLeft === "ended" ? "Ended" : `${timeLeft} left`}
              </span>
            </div>
          </div>

          {/* Main prediction line */}
          <div className="mt-3 flex items-center gap-2">
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
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                ends {new Date(prediction.timeframeEnd * 1000).toLocaleString()}
              </span>
          </div>

          {/* Market module */}
          <div className="mt-4">
            <MarketBar
              totalForBaseUnits={prediction.stakeSummary.totalFor}
              totalAgainstBaseUnits={prediction.stakeSummary.totalAgainst}
              compact={false}
            />
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

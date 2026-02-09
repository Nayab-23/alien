"use client";

import { useEffect, useMemo, useState } from "react";
import { MarketBar } from "@/components/MarketBar";

type Side = "for" | "against";

export type BetSheetPrediction = {
  id: number;
  assetSymbol: string;
  direction: "up" | "down";
  stakeSummary: {
    totalFor: string;
    totalAgainst: string;
    stakeCount: number;
  };
};

function baseToNumber(baseUnits: string): number {
  const n = Number(baseUnits);
  if (!Number.isFinite(n)) return 0;
  return n / 1e18;
}

function numberToBase(amount: number): string {
  const clamped = Math.max(0, amount);
  return String(Math.round(clamped * 1e18));
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  if (n >= 1000) return `$${n.toFixed(0)}`;
  if (n >= 10) return `$${n.toFixed(0)}`;
  return `$${n.toFixed(2)}`;
}

export function BetSheet({
  open,
  prediction,
  authToken,
  onClose,
  onSuccess,
  onRequireAuth,
  onOptimistic,
  onOptimisticRollback,
}: {
  open: boolean;
  prediction: BetSheetPrediction | null;
  authToken: string | null;
  onClose: () => void;
  onSuccess: (result: {
    stake: {
      id: number;
      userId: number;
      side: Side;
      amountBaseUnits: string;
      currency: string;
      createdAt: string;
    };
    stakeSummary: {
      totalFor: string;
      totalAgainst: string;
      stakeCount: number;
    };
  }) => void;
  onRequireAuth?: () => void;
  onOptimistic?: (stakeSummary: {
    totalFor: string;
    totalAgainst: string;
    stakeCount: number;
  }) => void;
  onOptimisticRollback?: () => void;
}) {
  const demoMode =
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

  const [side, setSide] = useState<Side>("for");
  const [amount, setAmount] = useState<number>(5);
  const [custom, setCustom] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addBaseUnits(a: string, b: string): string {
    try {
      return (BigInt(a) + BigInt(b)).toString();
    } catch {
      return a;
    }
  }

  useEffect(() => {
    if (!open) return;
    setSide("for");
    setAmount(5);
    setCustom("");
    setSubmitting(false);
    setError(null);
  }, [open, prediction?.id]);

  const totals = useMemo(() => {
    if (!prediction) return { forUsd: 0, againstUsd: 0, forPct: 50 };
    const forUsd = baseToNumber(prediction.stakeSummary.totalFor);
    const againstUsd = baseToNumber(prediction.stakeSummary.totalAgainst);
    const total = forUsd + againstUsd;
    const forPct = total > 0 ? Math.round((forUsd / total) * 100) : 50;
    return { forUsd, againstUsd, forPct };
  }, [prediction]);

  const implied = useMemo(() => {
    const { forPct } = totals;
    return {
      forPct,
      againstPct: 100 - forPct,
    };
  }, [totals]);

  const previewStakeSummary = useMemo(() => {
    if (!prediction) return null;
    const amtBase = numberToBase(amount);
    return {
      totalFor:
        side === "for"
          ? addBaseUnits(prediction.stakeSummary.totalFor, amtBase)
          : prediction.stakeSummary.totalFor,
      totalAgainst:
        side === "against"
          ? addBaseUnits(prediction.stakeSummary.totalAgainst, amtBase)
          : prediction.stakeSummary.totalAgainst,
      stakeCount: prediction.stakeSummary.stakeCount + 1,
    };
  }, [amount, prediction, side]);

  const potentialPayout = useMemo(() => {
    if (!prediction) return 0;
    const forPool = totals.forUsd;
    const againstPool = totals.againstUsd;
    const a = Math.max(0, amount);
    if (a === 0) return 0;
    if (side === "for") {
      return a + (a / (forPool + a)) * againstPool;
    }
    return a + (a / (againstPool + a)) * forPool;
  }, [amount, prediction, side, totals]);

  if (!open || !prediction) return null;

  async function confirm() {
    if (!authToken) {
      onRequireAuth?.();
      return;
    }
    if (!prediction) return;
    if (!demoMode) {
      setError("Demo mode is required for this build.");
      return;
    }

    setSubmitting(true);
    setError(null);
    if (previewStakeSummary) onOptimistic?.(previewStakeSummary);
    try {
      const res = await fetch("/api/stakes/demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          prediction_id: prediction.id,
          side,
          amount: String(amount.toFixed(2)),
          currency: "DEMO",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Failed to place demo bet");
        onOptimisticRollback?.();
        return;
      }
      onSuccess({
        stake: {
          id: data.stake.id,
          userId: data.stake.userId,
          side: data.stake.side,
          amountBaseUnits: data.stake.amountBaseUnits,
          currency: data.stake.currency,
          createdAt: data.stake.createdAt,
        },
        stakeSummary: data.stakeSummary,
      });
      onClose();
    } catch {
      setError("Network error");
      onOptimisticRollback?.();
    } finally {
      setSubmitting(false);
    }
  }

  function pickPreset(n: number) {
    setAmount(n);
    setCustom("");
  }

  function applyCustom(v: string) {
    setCustom(v);
    const parsed = Number(v);
    if (Number.isFinite(parsed)) setAmount(Math.max(0, parsed));
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close bet sheet"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <div className="rounded-t-3xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                Bet on {prediction.assetSymbol} {prediction.direction === "up" ? "UP" : "DOWN"}
              </div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {demoMode ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60">
                    Demo Mode
                    <span className="font-medium text-amber-700/80 dark:text-amber-200/80">
                      Simulated transfers
                    </span>
                  </span>
                ) : (
                  "Demo mode disabled"
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900/50 dark:text-zinc-100 dark:ring-zinc-800"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              Choose side
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSide("for")}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ring-inset transition ${
                  side === "for"
                    ? "bg-emerald-600 text-white ring-emerald-600"
                    : "bg-white text-zinc-800 ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
                }`}
              >
                For
              </button>
              <button
                type="button"
                onClick={() => setSide("against")}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ring-inset transition ${
                  side === "against"
                    ? "bg-rose-600 text-white ring-rose-600"
                    : "bg-white text-zinc-800 ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
                }`}
              >
                Against
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
            <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
              <div className="font-semibold">Market odds (derived)</div>
              <div className="tabular-nums">
                For {implied.forPct}% · Against {implied.againstPct}%
              </div>
            </div>
            <div className="mt-2">
              <MarketBar
                totalForBaseUnits={prediction.stakeSummary.totalFor}
                totalAgainstBaseUnits={prediction.stakeSummary.totalAgainst}
                compact
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              Amount
            </div>
            <div className="mt-2 flex items-center gap-2">
              {[1, 5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => pickPreset(n)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset transition ${
                    amount === n && custom === ""
                      ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:ring-zinc-50"
                      : "bg-white text-zinc-700 ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
                  }`}
                >
                  ${n}
                </button>
              ))}
              <div className="flex-1" />
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
              <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">$</span>
              <input
                inputMode="decimal"
                value={custom}
                onChange={(e) => applyCustom(e.target.value)}
                placeholder={String(amount)}
                className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
              />
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
            <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
              <div className="font-semibold">Preview (after your bet)</div>
              <div className="tabular-nums">
                {side === "for" ? "For" : "Against"} +{fmtMoney(amount)}
              </div>
            </div>
            {previewStakeSummary && (
              <div className="mt-2">
                <MarketBar
                  totalForBaseUnits={previewStakeSummary.totalFor}
                  totalAgainstBaseUnits={previewStakeSummary.totalAgainst}
                  compact
                />
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
            <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
              <div className="font-semibold">Potential payout (simulated)</div>
              <div className="font-extrabold text-zinc-900 dark:text-zinc-50 tabular-nums">
                {fmtMoney(potentialPayout)}
              </div>
            </div>
            <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              Includes your stake plus a share of the opposite pool if your side wins.
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900/60">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={confirm}
            disabled={submitting || amount <= 0}
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50 active:scale-[0.99] dark:bg-zinc-50 dark:text-zinc-950"
          >
            {submitting ? "Confirming..." : "Confirm Bet"}
          </button>

          <div className="sr-only">{numberToBase(amount)}</div>
        </div>
      </div>
    </div>
  );
}

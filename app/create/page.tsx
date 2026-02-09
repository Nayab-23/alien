"use client";

import { useState } from "react";
import { useAuth } from "@/components/MiniKitProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/Skeleton";
import { dataClient } from "@/lib/data/dataClient";

const ASSETS = ["BTC", "ETH", "SOL", "WLD"];

export default function CreatePrediction() {
  const { isAuthenticated, authToken, isLoading } = useAuth();
  const router = useRouter();

  const [assetSymbol, setAssetSymbol] = useState("BTC");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [confidence, setConfidence] = useState(50);
  const [timeframeDays, setTimeframeDays] = useState(7);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authToken) return;

    setSubmitting(true);
    setError(null);

    const timeframeEnd = Math.floor(Date.now() / 1000) + timeframeDays * 86400;

    try {
      const created = await dataClient.createPrediction({
        assetSymbol,
        direction,
        timeframeEnd,
        confidence,
        authToken,
      });
      router.push(`/predictions/${created.id}`);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-2xl px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
          <Skeleton className="h-6 w-40 rounded-xl" />
          <div className="mt-6 space-y-3 pb-[calc(env(safe-area-inset-bottom)+24px)]">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Skeleton className="h-10 w-full rounded-2xl" />
                <Skeleton className="h-10 w-full rounded-2xl" />
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
              <Skeleton className="h-36 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-300">
          Open this app inside Alien to create predictions.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-gray-50/90 backdrop-blur supports-[backdrop-filter]:bg-gray-50/70 dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="max-w-2xl mx-auto px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800"
            aria-label="Back"
          >
            <span className="text-lg">←</span>
          </Link>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight">Create</h1>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Post a call. Let the market react.
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              Your call
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="What’s your take? Add a thesis or a source."
              className="mt-2 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:ring-zinc-200"
            />

            <div className="mt-4 grid gap-3">
              <div>
                <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Asset
                </div>
                <div className="mt-2 flex gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
                  {ASSETS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAssetSymbol(a)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset transition ${
                        assetSymbol === a
                          ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:ring-zinc-50"
                          : "bg-white text-zinc-700 ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection("up")}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ring-inset transition ${
                    direction === "up"
                      ? "bg-emerald-600 text-white ring-emerald-600"
                      : "bg-white text-zinc-800 ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
                  }`}
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("down")}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold ring-1 ring-inset transition ${
                    direction === "down"
                      ? "bg-rose-600 text-white ring-rose-600"
                      : "bg-white text-zinc-800 ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
                  }`}
                >
                  Down
                </button>
              </div>

              <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                    Confidence
                  </div>
                  <div className="text-xs font-extrabold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {confidence}%
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={confidence}
                  onChange={(e) => setConfidence(parseInt(e.target.value))}
                  className="mt-2 w-full"
                />
                <div className="mt-1 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span>low</span>
                  <span>high</span>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Timeframe
                </div>
                <div className="mt-2 flex gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch]">
                  {[1, 3, 7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setTimeframeDays(d)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset transition ${
                        timeframeDays === d
                          ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:ring-zinc-50"
                          : "bg-white text-zinc-700 ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Preview
                </div>
                <div className="mt-1 text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {assetSymbol} {direction === "up" ? "UP" : "DOWN"} · {timeframeDays}d
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-900/60 dark:text-zinc-200 dark:ring-zinc-800">
                {confidence}% conf
              </span>
            </div>
            <div className="mt-3 rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-800 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800">
              {draft.trim().length > 0 ? draft.trim() : "Add a quick thesis or source."}
            </div>
          </section>

          {error && (
            <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900/60">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50 active:scale-[0.99] dark:bg-zinc-50 dark:text-zinc-950"
          >
            {submitting ? "Posting..." : `Post`}
          </button>
        </form>
      </main>
    </div>
  );
}

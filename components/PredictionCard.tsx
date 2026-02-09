"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export type FeedPrediction = {
  id: number;
  creatorUserId?: number;
  creatorIsFollowed?: boolean;
  assetSymbol: string;
  direction: "up" | "down";
  timeframeEnd: number;
  confidence: number;
  status: string;
  createdAt: string;
  score?: number;
  userVote?: -1 | 0 | 1;
  stakeSummary: {
    totalFor: string;
    totalAgainst: string;
    stakeCount: number;
  };
};

function formatCompactWLD(baseUnits: string): string {
  const wld = Number(baseUnits) / 1e18;
  if (!Number.isFinite(wld)) return "0";
  if (wld >= 1000) return `${(wld / 1000).toFixed(1)}k`;
  if (wld >= 100) return `${wld.toFixed(0)}`;
  return wld.toFixed(2);
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

function handleFromCreatorId(creatorUserId?: number): string {
  if (!creatorUserId) return "anon";
  return `signal${creatorUserId}`;
}

function avatarBgFromId(id: number): string {
  const hues = [25, 190, 280, 140, 330, 210, 70];
  const hue = hues[id % hues.length];
  return `hsl(${hue} 70% 45%)`;
}

export function PredictionCard({
  prediction,
  commentsCount = 0,
  onBet,
  onComment,
  authToken,
  onRequireAuth,
  currentUserId,
  onFollowChange,
}: {
  prediction: FeedPrediction;
  commentsCount?: number;
  onBet?: (predictionId: number) => void;
  onComment?: (predictionId: number) => void;
  authToken?: string | null;
  onRequireAuth?: () => void;
  currentUserId?: number | null;
  onFollowChange?: (creatorUserId: number, nextFollowing: boolean) => void;
}) {
  const router = useRouter();
  const [vote, setVote] = useState<-1 | 0 | 1>((prediction.userVote ?? 0) as -1 | 0 | 1);
  const [score, setScore] = useState<number>(prediction.score ?? 0);

  useEffect(() => {
    setVote((prediction.userVote ?? 0) as -1 | 0 | 1);
    setScore(prediction.score ?? 0);
  }, [prediction.id, prediction.userVote, prediction.score]);

  function applyOptimistic(nextVote: -1 | 0 | 1) {
    setScore((s) => s + (nextVote - vote));
    setVote(nextVote);
  }

  async function persistVote(nextVote: -1 | 0 | 1) {
    if (!authToken) {
      onRequireAuth?.();
      return;
    }
    const prevVote = vote;
    const prevScore = score;
    applyOptimistic(nextVote);

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          target_type: "prediction",
          target_id: prediction.id,
          value: nextVote,
        }),
      });
      if (!res.ok) throw new Error("vote failed");
      const data = await res.json();
      setScore(Number(data.score ?? 0));
      setVote((Number(data.userVote ?? 0) as -1 | 0 | 1) ?? 0);
    } catch {
      setVote(prevVote);
      setScore(prevScore);
    }
  }

  const creatorHandle = useMemo(
    () => handleFromCreatorId(prediction.creatorUserId),
    [prediction.creatorUserId]
  );

  const timeLeft = useMemo(
    () => formatTimeLeft(prediction.timeframeEnd),
    [prediction.timeframeEnd]
  );

  const directionLabel = prediction.direction === "up" ? "UP" : "DOWN";
  const directionTone =
    prediction.direction === "up"
      ? "text-emerald-700 bg-emerald-50 ring-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/60 dark:ring-emerald-900"
      : "text-rose-700 bg-rose-50 ring-rose-200 dark:text-rose-300 dark:bg-rose-950/60 dark:ring-rose-900";

  const confidenceTone =
    prediction.confidence >= 75
      ? "text-indigo-700 bg-indigo-50 ring-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/60 dark:ring-indigo-900"
      : "text-zinc-700 bg-zinc-100 ring-zinc-200 dark:text-zinc-200 dark:bg-zinc-900/60 dark:ring-zinc-800";

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/predictions/${prediction.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") router.push(`/predictions/${prediction.id}`);
      }}
      className="block rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-950/60"
    >
      <div className="flex items-start gap-3">
        <div
          className="h-10 w-10 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/10"
          style={{ background: avatarBgFromId(prediction.creatorUserId ?? prediction.id) }}
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={prediction.creatorUserId ? `/users/${prediction.creatorUserId}` : "#"}
                onClick={(e) => {
                  if (!prediction.creatorUserId) e.preventDefault();
                  e.stopPropagation();
                }}
                className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50"
              >
                @{creatorHandle}
              </Link>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {new Date(prediction.createdAt).toLocaleDateString()}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {prediction.creatorUserId &&
                prediction.creatorUserId !== (currentUserId ?? -1) &&
                !prediction.creatorIsFollowed && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!authToken) {
                        onRequireAuth?.();
                        return;
                      }
                      try {
                        const res = await fetch(`/api/follow/${prediction.creatorUserId}`, {
                          method: "POST",
                          headers: { Authorization: `Bearer ${authToken}` },
                        });
                        if (!res.ok) throw new Error("follow failed");
                        onFollowChange?.(prediction.creatorUserId, true);
                      } catch {
                        // no-op
                      }
                    }}
                    className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-zinc-800 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
                  >
                    Follow
                  </button>
                )}
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${confidenceTone}`}
              >
                {prediction.confidence}% conf
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-lg font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              {prediction.assetSymbol}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${directionTone}`}
            >
              {directionLabel}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              ends in {timeLeft}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/60">
              <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">
                For
              </div>
              <div className="mt-1 text-sm font-extrabold text-emerald-900 dark:text-emerald-100">
                {formatCompactWLD(prediction.stakeSummary.totalFor)} WLD
              </div>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:ring-rose-900/60">
              <div className="text-[11px] font-semibold text-rose-800 dark:text-rose-200">
                Against
              </div>
              <div className="mt-1 text-sm font-extrabold text-rose-900 dark:text-rose-100">
                {formatCompactWLD(prediction.stakeSummary.totalAgainst)} WLD
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {score}
                </span>
                <span>score</span>
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span>{commentsCount} comments</span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span>{prediction.stakeSummary.stakeCount} bets</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void persistVote(vote === 1 ? 0 : 1);
                }}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-inset transition ${
                  vote === 1
                    ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:ring-zinc-50"
                    : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800 dark:hover:bg-zinc-900/40"
                }`}
                aria-label="Upvote"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void persistVote(vote === -1 ? 0 : -1);
                }}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-inset transition ${
                  vote === -1
                    ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:ring-zinc-50"
                    : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800 dark:hover:bg-zinc-900/40"
                }`}
                aria-label="Downvote"
              >
                ▼
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBet?.(prediction.id);
              }}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.99] dark:bg-zinc-50 dark:text-zinc-950"
            >
              Bet
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onComment?.(prediction.id);
              }}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 ring-1 ring-inset ring-zinc-200 transition active:scale-[0.99] dark:bg-zinc-900/50 dark:text-zinc-100 dark:ring-zinc-800"
            >
              Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

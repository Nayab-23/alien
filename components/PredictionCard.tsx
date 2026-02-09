"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MarketBar } from "@/components/MarketBar";

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

function formatAge(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
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
  const creatorId = prediction.creatorUserId;

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
    () => handleFromCreatorId(creatorId),
    [creatorId]
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
      ? "text-amber-800 bg-amber-100 ring-amber-200 dark:text-amber-200 dark:bg-amber-950/40 dark:ring-amber-900/60"
      : "text-zinc-700 bg-zinc-100 ring-zinc-200 dark:text-zinc-200 dark:bg-zinc-900/60 dark:ring-zinc-800";

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/predictions/${prediction.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") router.push(`/predictions/${prediction.id}`);
      }}
      className="block rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-950/60"
    >
      <div className="flex items-start gap-3">
        <div
          className="h-9 w-9 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/10"
          style={{ background: avatarBgFromId(prediction.creatorUserId ?? prediction.id) }}
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          {/* Creator row */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <Link
                  href={creatorId ? `/users/${creatorId}` : "#"}
                  onClick={(e) => {
                    if (!creatorId) e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  @{creatorHandle}
                </Link>
                <span className="shrink-0 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  · {formatAge(prediction.createdAt)}
                </span>
              </div>
            </div>

            {creatorId &&
              creatorId !== (currentUserId ?? -1) &&
              !prediction.creatorIsFollowed && (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!creatorId) return;
                    if (!authToken) {
                      onRequireAuth?.();
                      return;
                    }
                    try {
                      const res = await fetch(`/api/follow/${creatorId}`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${authToken}` },
                      });
                      if (!res.ok) throw new Error("follow failed");
                      onFollowChange?.(creatorId, true);
                    } catch {
                      // no-op
                    }
                  }}
                  className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-zinc-800 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
                >
                  Follow
                </button>
              )}
          </div>

          {/* Main prediction line */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              {prediction.assetSymbol}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold ring-1 ring-inset ${directionTone}`}
            >
              {directionLabel}
            </span>
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              {timeLeft === "ended" ? "Ended" : `${timeLeft} left`}
            </span>
          </div>

          {/* Market module */}
          <div className="mt-3">
            <MarketBar
              totalForBaseUnits={prediction.stakeSummary.totalFor}
              totalAgainstBaseUnits={prediction.stakeSummary.totalAgainst}
              compact
            />
          </div>

          {/* Action row */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBet?.(prediction.id);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white transition active:scale-[0.99] dark:bg-zinc-50 dark:text-zinc-950"
            >
              Bet
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onComment) {
                  onComment(prediction.id);
                } else {
                  router.push(`/predictions/${prediction.id}`);
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-100 px-3 py-2.5 text-sm font-semibold text-zinc-900 ring-1 ring-inset ring-zinc-200 transition active:scale-[0.99] dark:bg-zinc-900/50 dark:text-zinc-100 dark:ring-zinc-800"
            >
              Comment
            </button>
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const path = `/predictions/${prediction.id}`;
                try {
                  const url =
                    typeof window !== "undefined"
                      ? `${window.location.origin}${path}`
                      : path;
                  // Prefer native share sheet when available.
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const nav: any = typeof navigator !== "undefined" ? navigator : null;
                  if (nav?.share) {
                    await nav.share({
                      title: "AnchorSignal prediction",
                      url,
                    });
                    return;
                  }
                  if (nav?.clipboard?.writeText) {
                    await nav.clipboard.writeText(url);
                  }
                } catch {
                  // no-op
                }
              }}
              className="inline-flex items-center justify-center rounded-2xl bg-white text-sm font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200 transition active:scale-[0.99] dark:bg-zinc-950/40 dark:text-zinc-200 dark:ring-zinc-800"
              aria-label="Share"
            >
              Share
            </button>
          </div>

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ring-inset ${confidenceTone}`}
            >
              {prediction.confidence}% conf
            </span>
            <span className="inline-flex items-center rounded-full bg-white px-2 py-1 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
              {timeLeft === "ended" ? "Ended" : `${timeLeft} left`}
            </span>
            {commentsCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-white px-2 py-1 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800 tabular-nums">
                💬 {commentsCount}
              </span>
            )}
            {score !== 0 && (
              <span className="inline-flex items-center rounded-full bg-white px-2 py-1 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800 tabular-nums">
                ▲ {score}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void persistVote(vote === 1 ? 0 : 1);
                }}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset transition ${
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
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset transition ${
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
        </div>
      </div>
    </div>
  );
}

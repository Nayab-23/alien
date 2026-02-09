"use client";

import { Skeleton, SkeletonText } from "@/components/Skeleton";

export function SkeletonPredictionCard() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <Skeleton className="h-4 w-32 rounded-lg" />
              <div className="mt-2">
                <Skeleton className="h-3 w-24 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>

          <div className="mt-4">
            <SkeletonText lines={2} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Skeleton className="h-4 w-44 rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Skeleton className="h-10 flex-1 rounded-xl" />
            <Skeleton className="h-10 flex-1 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}


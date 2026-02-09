"use client";

export function Skeleton({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({
  lines = 2,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/70 ${
            i === lines - 1 ? "w-2/3" : "w-full"
          }`}
        />
      ))}
    </div>
  );
}


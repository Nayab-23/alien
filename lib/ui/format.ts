function toNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(String(value));
  if (!Number.isFinite(n)) return null;
  return n;
}

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs < 0.01 && abs !== 0) return `${sign}<0.01`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
  if (abs >= 100) return `${value.toFixed(0)}`;
  if (abs >= 10) return `${value.toFixed(1)}`;
  return `${value.toFixed(2)}`;
}

export function formatBaseUnits1e18(baseUnits: string): string {
  const n = toNumber(baseUnits);
  if (n === null) return "—";
  return formatCompactNumber(n / 1e18);
}


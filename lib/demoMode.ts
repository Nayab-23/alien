export function isDemoMode(): boolean {
  return (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  );
}


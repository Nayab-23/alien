export function isDemoMode(): boolean {
  // Client-side override for demos without rebuilds.
  if (typeof window !== "undefined") {
    // Optional URL override: ?demo=1 or ?demo=0
    try {
      const url = new URL(window.location.href);
      const demo = url.searchParams.get("demo");
      if (demo === "1") return true;
      if (demo === "0") return false;
    } catch {
      // ignore
    }

    try {
      const forced = window.localStorage.getItem("anchorsignal_demo_mode");
      if (forced === "true") return true;
      if (forced === "false") return false;
    } catch {
      // ignore
    }
  }

  const v = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_DEMO_MODE : undefined;
  if (v === "true") return true;
  if (v === "false") return false;

  // Default to demo unless explicitly disabled.
  return true;
}

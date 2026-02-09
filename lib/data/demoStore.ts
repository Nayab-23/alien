import { makeInitialDemoState, type DemoState } from "@/demo/demoData";

const STORAGE_KEY = "anchorsignal_demo_state_v1";
let cached: DemoState | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function loadFromStorage(): DemoState | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoState;
    if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.predictions)) return null;
    if (parsed.predictions.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(state: DemoState) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function getDemoState(): DemoState {
  if (cached) return cached;
  const loaded = loadFromStorage();
  cached = loaded ?? makeInitialDemoState();
  saveToStorage(cached);
  return cached;
}

export function updateDemoState(mutator: (state: DemoState) => void): DemoState {
  const state = getDemoState();
  mutator(state);
  saveToStorage(state);
  return state;
}

export function resetDemoState(): DemoState {
  cached = makeInitialDemoState();
  saveToStorage(cached);
  return cached;
}

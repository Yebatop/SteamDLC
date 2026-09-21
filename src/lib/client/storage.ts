const PREFIX = "steamdlc:";

export const KEYS = {
  settings: `${PREFIX}settings`,
  sync: `${PREFIX}sync`,
  ownership: `${PREFIX}ownership`,
  filters: `${PREFIX}filters`,
  selection: `${PREFIX}selection`,
  bought: `${PREFIX}bought`,
  watchToken: `${PREFIX}watch-token`,
} as const;

export function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Квота localStorage кончилась — не роняем интерфейс из-за кэша.
  }
}

export function removeKey(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export function clearAll(): void {
  for (const key of Object.values(KEYS)) removeKey(key);
}

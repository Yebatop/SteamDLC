/**
 * Тонкая обёртка над fetch для Steam: таймауты, ретраи и уважение к 429.
 *
 * Store API (store.steampowered.com/api/*) лимитирует примерно 200 запросов
 * за 5 минут на IP. На Vercel IP общий, поэтому 429 — штатная ситуация,
 * а не исключение: ловим, ждём и повторяем.
 */

export class SteamHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SteamHttpError";
  }
}

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GetJsonOptions {
  /** Сколько секунд Next.js может держать ответ в Data Cache. 0 — не кэшировать. */
  revalidate?: number;
  timeoutMs?: number;
  attempts?: number;
}

export async function getJson<T>(url: string, options: GetJsonOptions = {}): Promise<T> {
  const { revalidate = 0, timeoutMs = DEFAULT_TIMEOUT_MS, attempts = MAX_ATTEMPTS } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          // Без внятного User-Agent Steam охотнее отдаёт 403.
          "User-Agent": "SteamDLC/0.1 (+https://github.com/yebatop/steamdlc)",
          Accept: "application/json",
        },
        ...(revalidate > 0 ? { next: { revalidate } } : { cache: "no-store" as const }),
      });

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after")) || 0;
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(2 ** attempt * 1000, 15_000);
        lastError = new SteamHttpError("Steam ограничил частоту запросов (429)", 429, true);
        if (attempt < attempts) {
          await sleep(waitMs);
          continue;
        }
        throw lastError;
      }

      if (response.status >= 500) {
        lastError = new SteamHttpError(`Steam ответил ${response.status}`, response.status, true);
        if (attempt < attempts) {
          await sleep(Math.min(2 ** attempt * 500, 8_000));
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        throw new SteamHttpError(`Steam ответил ${response.status}`, response.status, false);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof SteamHttpError && !error.retryable) throw error;
      lastError = error;
      if (attempt < attempts) {
        await sleep(Math.min(2 ** attempt * 500, 8_000));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new SteamHttpError("Не удалось получить ответ от Steam", 0, true);
}

/** Выполняет задачи с ограниченным параллелизмом, сохраняя порядок результатов. */
export async function pool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

import { cleanDetail, SteamHttpError } from "./errors";

/**
 * Тонкая обёртка над fetch для Steam: таймауты, ретраи и уважение к 429.
 *
 * Store API (store.steampowered.com/api/*) лимитирует примерно 200 запросов
 * за 5 минут на IP. На Vercel IP общий, поэтому 429 — штатная ситуация,
 * а не исключение: ловим, ждём и повторяем.
 *
 * Все ошибки поднимаются наверх как SteamHttpError с хостом и куском тела
 * ответа: без этого 403 «ключ не принят» не отличить от 403 «IP не нравится».
 */

export { SteamHttpError };

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 4;
/** Больше и не нужно: Steam пишет причину в первых строках. */
const DETAIL_LIMIT = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** Тело ошибочного ответа: полезно, но не должно ронять обработку. */
async function detailOf(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return cleanDetail(text.slice(0, DETAIL_LIMIT));
  } catch {
    return "";
  }
}

interface GetJsonOptions {
  /** Сколько секунд Next.js может держать ответ в Data Cache. 0 — не кэшировать. */
  revalidate?: number;
  timeoutMs?: number;
  attempts?: number;
}

export async function getJson<T>(url: string, options: GetJsonOptions = {}): Promise<T> {
  const { revalidate = 0, timeoutMs = DEFAULT_TIMEOUT_MS, attempts = MAX_ATTEMPTS } = options;
  const host = hostOf(url);
  let lastError: SteamHttpError | null = null;

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
        lastError = new SteamHttpError("Steam ограничил частоту запросов (429)", 429, true, host);
        if (attempt < attempts) {
          await sleep(waitMs);
          continue;
        }
        throw lastError;
      }

      if (response.status >= 500) {
        lastError = new SteamHttpError(
          `Steam ответил ${response.status}`,
          response.status,
          true,
          host,
          await detailOf(response),
        );
        if (attempt < attempts) {
          await sleep(Math.min(2 ** attempt * 500, 8_000));
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        // 400-е не ретраим: повтор с тем же ключом или appid ничего не изменит.
        throw new SteamHttpError(
          `Steam ответил ${response.status}`,
          response.status,
          false,
          host,
          await detailOf(response),
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof SteamHttpError) {
        if (!error.retryable) throw error;
        lastError = error;
      } else {
        // Обрыв связи, таймаут, DNS: статус 0 означает «ответа не было вовсе».
        const reason = error instanceof Error ? error.message : String(error);
        lastError = new SteamHttpError(
          `Нет ответа от ${host || "Steam"}`,
          0,
          true,
          host,
          cleanDetail(reason),
        );
      }

      if (attempt < attempts) {
        await sleep(Math.min(2 ** attempt * 500, 8_000));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new SteamHttpError("Не удалось получить ответ от Steam", 0, true, host);
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

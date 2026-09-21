import {
  buildAppDetailsUrl,
  hasNames,
  looksEmpty,
  type RawResponse,
} from "../steam/parse";

/**
 * Поход в витрину Steam прямо из браузера.
 *
 * Зачем: витрина считает лимит запросов по IP, а у хостинга он общий с чужими
 * проектами и выжжен ещё до нас — на практике проходит пять-шесть запросов,
 * дальше 429 на минуты. Домашний IP пользователя расходует только он сам,
 * и вся библиотека укладывается в десяток запросов.
 *
 * Получится ли — зависит от того, отдаёт ли витрина заголовки CORS. Проверяем
 * на ходу: не пустила — молча уходим на серверный маршрут, как раньше.
 */

export type DirectStatus = "unknown" | "works" | "blocked";

export type DirectResult =
  | { ok: true; body: RawResponse }
  | { ok: false; reason: "blocked" | "rate-limited" | "error" };

const STORAGE_KEY = "steamdlc:direct";

let status: DirectStatus = "unknown";

export function directStatus(): DirectStatus {
  if (status === "unknown" && typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "works" || stored === "blocked") status = stored;
  }
  return status;
}

function remember(next: DirectStatus): void {
  status = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Приватный режим — переживём, просто проверим ещё раз в следующий раз.
  }
}

/** Сбрасывает вердикт: пригодится, если пользователь сменил сеть или браузер. */
export function forgetDirectStatus(): void {
  status = "unknown";
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export interface DirectOptions {
  appids: number[];
  filters: string;
  cc: string;
  lang: string;
  signal?: AbortSignal;
  /** Ответ должен содержать имена: иначе набор filters оказался бедным. */
  expectNames?: boolean;
}

export async function fetchAppDetailsDirect(options: DirectOptions): Promise<DirectResult> {
  const url = buildAppDetailsUrl(options.appids, options.filters, options.cc, options.lang);

  let response: Response;
  try {
    response = await fetch(url, { signal: options.signal, credentials: "omit" });
  } catch (error) {
    // Прерывание пользователем — не повод считать витрину закрытой.
    if (options.signal?.aborted) return { ok: false, reason: "error" };
    // Отказ CORS приходит сюда же, различить его иначе браузер не даёт.
    remember("blocked");
    void error;
    return { ok: false, reason: "blocked" };
  }

  if (response.status === 429) {
    // Ответ получен — значит путь открыт, просто сейчас лимит.
    remember("works");
    return { ok: false, reason: "rate-limited" };
  }

  if (!response.ok) return { ok: false, reason: "error" };

  let body: RawResponse | null;
  try {
    body = (await response.json()) as RawResponse | null;
  } catch {
    return { ok: false, reason: "error" };
  }

  if (!body || looksEmpty(body) || (options.expectNames && !hasNames(body))) {
    // Данные пустые: пусть сервер попробует своим каскадом наборов filters.
    return { ok: false, reason: "error" };
  }

  remember("works");
  return { ok: true, body };
}

/** Одиночная проверка доступности для диагностики. */
export async function probeDirect(): Promise<boolean> {
  const result = await fetchAppDetailsDirect({
    appids: [440],
    filters: "basic",
    cc: "us",
    lang: "english",
  });
  return result.ok || result.reason === "rate-limited";
}

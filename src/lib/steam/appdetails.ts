import { SteamHttpError } from "./errors.ts";
import { firstFilters, nextFilters, type FilterPurpose } from "./filters.ts";
import { chunk, getJson, pool } from "./http.ts";

/**
 * Клиент к store.steampowered.com/api/appdetails.
 *
 * Эндпоинт неофициальный и капризный, поэтому здесь три подстраховки:
 *
 * 1. Неизвестное имя в `filters` — это 400 с телом `null`, а не игнорирование.
 *    Набор подбирается каскадом (см. ./filters) и рабочий запоминается.
 * 2. Батчинг (`appids=1,2,3`) нигде не обещан: проверяем, что в ответе есть
 *    КАЖДЫЙ запрошенный appid, и при обрезке переходим на одиночные запросы.
 * 3. `success: false` — нормальный ответ для снятого с продажи или
 *    недоступного в регионе DLC, а не ошибка.
 *
 * Отдельное правило: неудача на одной пачке не должна отменять всю
 * синхронизацию. Такие appid помечаются недоступными и считаются отдельно —
 * лучше отдать 290 игр из 297, чем ничего.
 */

export interface RawAppData {
  name?: string;
  type?: string;
  is_free?: boolean;
  dlc?: number[];
  fullgame?: { appid?: string | number; name?: string };
  release_date?: { coming_soon?: boolean; date?: string };
  price_overview?: {
    currency?: string;
    initial?: number;
    final?: number;
    discount_percent?: number;
    final_formatted?: string;
  };
  genres?: Array<{ id?: string | number; description?: string }>;
  categories?: Array<{ id?: number; description?: string }>;
}

type RawResponse = Record<string, { success?: boolean; data?: RawAppData } | undefined>;

/** null означает, что данных нет: Steam ответил success:false или запрос не удался. */
export type AppDetailsMap = Map<number, RawAppData | null>;

export interface AppDetailsResult {
  data: AppDetailsMap;
  /** Сколько appid не удалось получить из-за ошибок (не из-за success:false). */
  failed: number;
}

/** Состояние подстройки живёт столько же, сколько инстанс функции. */
const mode: { batchSize: number; filters: Record<FilterPurpose, string> } = {
  batchSize: 40,
  filters: {
    dlcList: firstFilters("dlcList"),
    item: firstFilters("item"),
  },
};

/**
 * Сбрасывает подстройку между тестами. В обычной работе состояние живёт
 * столько же, сколько инстанс функции, и сбрасывать его незачем.
 */
export function resetAdaptiveMode(): void {
  mode.batchSize = 40;
  mode.filters.dlcList = firstFilters("dlcList");
  mode.filters.item = firstFilters("item");
}

export interface AppDetailsOptions {
  cc: string;
  lang: string;
  purpose: FilterPurpose;
  /** Сколько секунд держать ответ в кэше Next.js. */
  revalidate?: number;
}

function buildUrl(appids: number[], filters: string, options: AppDetailsOptions): string {
  const params = new URLSearchParams({
    appids: appids.join(","),
    filters,
    cc: options.cc,
    l: options.lang,
  });
  return `https://store.steampowered.com/api/appdetails?${params.toString()}`;
}

async function fetchRaw(
  appids: number[],
  filters: string,
  options: AppDetailsOptions,
): Promise<RawResponse> {
  const body = await getJson<RawResponse | null>(buildUrl(appids, filters, options), {
    revalidate: options.revalidate ?? 0,
  });
  return body ?? {};
}

const isBadRequest = (error: unknown) =>
  error instanceof SteamHttpError && error.status === 400;

/** Есть ли в ответе хоть одно имя: признак того, что набор filters достаточный. */
function hasNames(body: RawResponse): boolean {
  return Object.values(body).some((entry) => Boolean(entry?.data?.name));
}

function hasPayload(body: RawResponse): boolean {
  return Object.values(body).some((entry) => entry?.success !== false && Boolean(entry?.data));
}

/**
 * Один запрос с перебором наборов filters. Бросает исключение, только если
 * не сработал ни один набор.
 */
async function requestWithCascade(
  appids: number[],
  options: AppDetailsOptions,
): Promise<RawResponse> {
  const { purpose } = options;
  let filters: string | null = mode.filters[purpose];
  let lastError: unknown;

  while (filters) {
    try {
      const body = await fetchRaw(appids, filters, options);

      // Данные есть, но без имён — значит набор беднее, чем нужно.
      if (purpose === "item" && hasPayload(body) && !hasNames(body)) {
        const fallback: string | null = nextFilters(purpose, filters);
        if (fallback) {
          filters = fallback;
          continue;
        }
      }

      mode.filters[purpose] = filters;
      return body;
    } catch (error) {
      // 400 означает, что витрина не поняла запрос: пробуем набор понадёжнее.
      if (!isBadRequest(error)) throw error;
      lastError = error;
      filters = nextFilters(purpose, filters);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new SteamHttpError("Витрина Steam не приняла запрос", 400, false);
}

/** Раскладывает ответ Steam по запрошенным appid, отдельно возвращая пропавшие. */
function collect(appids: number[], body: RawResponse, into: AppDetailsMap): number[] {
  const missing: number[] = [];

  for (const appid of appids) {
    const entry = body[String(appid)];
    if (!entry) {
      missing.push(appid);
      continue;
    }
    into.set(appid, entry.success === false || !entry.data ? null : entry.data);
  }

  return missing;
}

/**
 * Возвращает данные по каждому запрошенному appid. Ключ есть всегда: либо
 * объект с данными, либо null (недоступно или не удалось получить).
 */
export async function fetchAppDetails(
  appids: number[],
  options: AppDetailsOptions,
): Promise<AppDetailsResult> {
  const result: AppDetailsMap = new Map();
  const unique = [...new Set(appids)].filter((id) => Number.isInteger(id) && id > 0);
  if (unique.length === 0) return { data: result, failed: 0 };

  const singles: number[] = [];
  const failed: number[] = [];
  let firstError: unknown;

  await pool(chunk(unique, mode.batchSize), 2, async (batch) => {
    try {
      const body = await requestWithCascade(batch, options);
      const missing = collect(batch, body, result);
      if (missing.length > 0) {
        // Батч обрезан — дальше работаем поштучно.
        if (batch.length > 1) mode.batchSize = 1;
        singles.push(...missing);
      }
    } catch (error) {
      firstError ??= error;
      // Возможно, витрине не понравился именно размер пачки.
      if (batch.length > 1) {
        mode.batchSize = 1;
        singles.push(...batch);
      } else {
        failed.push(...batch);
      }
    }
  });

  if (singles.length > 0) {
    await pool(singles, 2, async (appid) => {
      try {
        const body = await requestWithCascade([appid], options);
        const missing = collect([appid], body, result);
        // Steam вообще не знает про этот appid — считаем недоступным.
        for (const id of missing) result.set(id, null);
      } catch (error) {
        firstError ??= error;
        failed.push(appid);
      }
    });
  }

  // Ничего не получилось вовсе — это настоящий сбой, о нём нужно сказать.
  if (failed.length === unique.length && firstError) throw firstError;

  for (const appid of failed) result.set(appid, null);
  return { data: result, failed: failed.length };
}

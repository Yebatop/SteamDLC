import { chunk, getJson, pool } from "./http";

/**
 * Клиент к store.steampowered.com/api/appdetails.
 *
 * Эндпоинт неофициальный, поэтому здесь три подстраховки:
 *
 * 1. Батчинг (`appids=1,2,3`) работает только вместе с `filters` и официально
 *    нигде не обещан. Мы проверяем, что в ответе есть КАЖДЫЙ запрошенный appid;
 *    если Steam молча отдал только первый — переключаемся на одиночные запросы.
 * 2. Набор `filters` из отдельных ключей (`name,type,...`) отдаёт компактный
 *    ответ, но поддерживается не всегда. Если в ответе нет `name` — откатываемся
 *    на группу `basic` (она тяжёлая: тянет описания, зато работает всегда).
 * 3. `success: false` для appid — это не ошибка, а нормальный ответ: DLC снято
 *    с продажи или недоступно в регионе. Такие помечаем как unavailable.
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

/** null означает, что Steam ответил success:false — приложение недоступно. */
export type AppDetailsMap = Map<number, RawAppData | null>;

const LEAN_FILTERS = "name,type,is_free,dlc,release_date,price_overview,genres,categories";
const FULL_FILTERS = "basic,price_overview,release_date,genres,categories";

/**
 * Состояние адаптации на время жизни инстанса функции. Если Steam один раз
 * показал, что батчи или компактные фильтры не работают, — больше не пробуем.
 */
const mode = {
  leanFilters: true,
  batchSize: 20,
};

export interface AppDetailsOptions {
  cc: string;
  lang: string;
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

/** Раскладывает ответ Steam по запрошенным appid, отдельно возвращая пропавшие. */
function collect(
  appids: number[],
  body: RawResponse,
  into: AppDetailsMap,
): { missing: number[]; sawName: boolean } {
  const missing: number[] = [];
  let sawName = false;

  for (const appid of appids) {
    const entry = body[String(appid)];
    if (!entry) {
      missing.push(appid);
      continue;
    }
    if (entry.success === false || !entry.data) {
      into.set(appid, null);
      continue;
    }
    if (entry.data.name) sawName = true;
    into.set(appid, entry.data);
  }

  return { missing, sawName };
}

/**
 * Возвращает данные по каждому запрошенному appid.
 * Ключ есть всегда: либо объект с данными, либо null (недоступно).
 */
export async function fetchAppDetails(
  appids: number[],
  options: AppDetailsOptions,
): Promise<AppDetailsMap> {
  const result: AppDetailsMap = new Map();
  const unique = [...new Set(appids)].filter((id) => Number.isInteger(id) && id > 0);
  if (unique.length === 0) return result;

  const retryOneByOne: number[] = [];

  await pool(chunk(unique, mode.batchSize), 2, async (batch) => {
    const filters = mode.leanFilters ? LEAN_FILTERS : FULL_FILTERS;
    const body = await fetchRaw(batch, filters, options);
    const { missing, sawName } = collect(batch, body, result);

    // Компактные фильтры не поддержаны — данные пришли без имён. Пробуем basic.
    if (mode.leanFilters && !sawName && batch.some((id) => result.get(id) !== null)) {
      mode.leanFilters = false;
      const retryBody = await fetchRaw(batch, FULL_FILTERS, options);
      collect(batch, retryBody, result);
      return;
    }

    if (missing.length > 0) {
      // Батч обрезан — дальше работаем поштучно.
      if (batch.length > 1) mode.batchSize = 1;
      retryOneByOne.push(...missing);
    }
  });

  if (retryOneByOne.length > 0) {
    await pool(retryOneByOne, 2, async (appid) => {
      const filters = mode.leanFilters ? LEAN_FILTERS : FULL_FILTERS;
      const body = await fetchRaw([appid], filters, options);
      const { missing } = collect([appid], body, result);
      // Steam вообще не знает про этот appid — считаем недоступным.
      for (const id of missing) result.set(id, null);
    });
  }

  return result;
}

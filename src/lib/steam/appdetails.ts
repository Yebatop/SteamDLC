import { SteamHttpError } from "./errors.ts";
import { firstFilters, nextFilters, type FilterPurpose } from "./filters.ts";
import {
  buildAppDetailsUrl,
  hasNames,
  hasPayload,
  looksEmpty,
  splitAppDetails,
  type RawAppData,
  type RawResponse,
} from "./parse.ts";
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

/** null означает, что данных нет: Steam ответил success:false или запрос не удался. */
export type AppDetailsMap = Map<number, RawAppData | null>;

export interface AppDetailsResult {
  data: AppDetailsMap;
  /** Сколько appid не удалось получить из-за ошибок (не из-за success:false). */
  failed: number;
  /**
   * appid с окончательным результатом. Всё, чего здесь нет, не успели
   * обработать до истечения бюджета времени — клиент попросит их снова.
   */
  processed: number[];
  /** Steam включил ограничение частоты: продолжать прямо сейчас бессмысленно. */
  throttled: boolean;
}

const MAX_BATCH = 40;
/** Ниже этого опускаться незачем: дальше растут только накладные расходы. */
const MIN_BATCH = 5;

/** Состояние подстройки живёт столько же, сколько инстанс функции. */
const mode: { batchSize: number; filters: Record<FilterPurpose, string> } = {
  batchSize: MAX_BATCH,
  filters: {
    dlcList: firstFilters("dlcList"),
    item: firstFilters("item"),
  },
};

/**
 * Сбрасывает подстройку между тестами. В обычной работе состояние живёт
 * столько же, сколько инстанс функции, и сбрасывать его незачем.
 */
export function currentBatchSize(): number {
  return mode.batchSize;
}

export function resetAdaptiveMode(): void {
  mode.batchSize = MAX_BATCH;
  mode.filters.dlcList = firstFilters("dlcList");
  mode.filters.item = firstFilters("item");
}

export interface AppDetailsOptions {
  cc: string;
  lang: string;
  purpose: FilterPurpose;
  /** Сколько секунд держать ответ в кэше Next.js. */
  revalidate?: number;
  /**
   * Момент (Date.now()), после которого новые запросы не начинаем.
   * Функция на хостинге живёт ограниченное время: лучше вернуть половину
   * результата, чем упереться в таймаут и потерять всё.
   */
  deadline?: number;
}

async function fetchRaw(
  appids: number[],
  filters: string,
  options: AppDetailsOptions,
): Promise<RawResponse> {
  const url = buildAppDetailsUrl(appids, filters, options.cc, options.lang);
  const body = await getJson<RawResponse | null>(url, {
    revalidate: options.revalidate ?? 0,
  });
  return body ?? {};
}

const isBadRequest = (error: unknown) =>
  error instanceof SteamHttpError && error.status === 400;

const isRateLimited = (error: unknown) =>
  error instanceof SteamHttpError && error.status === 429;

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

      // Набор filters не дал ничего полезного — пробуем следующий.
      const insufficient =
        looksEmpty(body) || (purpose === "item" && hasPayload(body) && !hasNames(body));

      if (insufficient) {
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

/** Складывает разобранный ответ в общий результат, возвращая пропавшие appid. */
function collect(appids: number[], body: RawResponse, into: AppDetailsMap): number[] {
  const { data, missing } = splitAppDetails(appids, body);
  for (const [appid, value] of data) into.set(appid, value);
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
  if (unique.length === 0) return { data: result, failed: 0, processed: [], throttled: false };

  const deadline = options.deadline ?? Number.POSITIVE_INFINITY;
  /**
   * Под ограничением частоты новые запросы только усугубляют дело: Steam
   * продлевает окно. Останавливаемся и отдаём то, что успели, — клиент
   * подождёт и продолжит с этого места.
   */
  let throttled = false;
  const shouldStop = () => throttled || Date.now() >= deadline;

  const singles: number[] = [];
  const failed: number[] = [];
  let firstError: unknown;

  /**
   * Пропуск нескольких appid — это «Steam не знает такие», а не сломанный
   * батчинг: так ведут себя делистнутые игры. Уменьшаем пачку вдвое и только
   * когда пропала бóльшая её часть — это уже похоже на обрезку ответа.
   */
  const shrinkBatch = () => {
    mode.batchSize = Math.max(MIN_BATCH, Math.floor(mode.batchSize / 2));
  };

  // Параллелизм 1: витрина считает запросы по IP, а на хостинге он общий.
  await pool(chunk(unique, mode.batchSize), 1, async (batch) => {
    if (shouldStop()) return;

    try {
      const body = await requestWithCascade(batch, options);
      const missing = collect(batch, body, result);
      if (missing.length > 0) {
        if (batch.length > 1 && missing.length > batch.length / 2) shrinkBatch();
        singles.push(...missing);
      }
    } catch (error) {
      firstError ??= error;

      // Ограничение частоты — не вина этих appid: вернём их нетронутыми.
      if (isRateLimited(error)) {
        throttled = true;
        return;
      }

      // Возможно, витрине не понравился именно размер пачки.
      if (batch.length > 1) {
        shrinkBatch();
        singles.push(...batch);
      } else {
        failed.push(...batch);
      }
    }
  });

  if (singles.length > 0) {
    await pool(singles, 1, async (appid) => {
      if (shouldStop()) return;

      try {
        const body = await requestWithCascade([appid], options);
        const missing = collect([appid], body, result);
        // Steam вообще не знает про этот appid — считаем недоступным.
        for (const id of missing) result.set(id, null);
      } catch (error) {
        firstError ??= error;
        if (isRateLimited(error)) {
          throttled = true;
          return;
        }
        failed.push(appid);
      }
    });
  }

  // Проверяем до того, как разложим провалы: иначе «не вышло ничего»
  // замаскируется под «всё обработано, просто недоступно».
  if (result.size === 0 && firstError) throw firstError;

  for (const appid of failed) result.set(appid, null);

  return { data: result, failed: failed.length, processed: [...result.keys()], throttled };
}

import { chunk, getJson, pool } from "./http.ts";
import { buildGetItemsInput, parseStoreItems, type RawStoreItem } from "./storeitem.ts";

/**
 * Клиент к IStoreBrowseService/GetItems на api.steampowered.com.
 *
 * Тот же магазин, но другой хост: store.steampowered.com ограничивает частоту
 * по IP, а на общем адресе хостинга эта квота исчерпана чужими проектами.
 * api.steampowered.com отвечает стабильно и принимает десятки appid за запрос,
 * поэтому цены тысяч DLC собираются десятками запросов, а не тысячами.
 */

const GET_ITEMS_URL = "https://api.steampowered.com/IStoreBrowseService/GetItems/v1/";
/** Сервис принимает большие пачки — этим он и ценен. */
const BATCH = 50;
const TTL = 60 * 30;

export interface StoreBrowseOptions {
  cc: string;
  lang: string;
  apiKey?: string;
  deadline?: number;
}

export interface StoreBrowseResult {
  items: Map<number, RawStoreItem>;
  /**
   * false — сервис недоступен или ответил незнакомым форматом.
   * Тогда вызывающий код уходит на appdetails, как раньше.
   */
  supported: boolean;
}

function buildUrl(appids: number[], options: StoreBrowseOptions): string {
  const params = new URLSearchParams({
    input_json: buildGetItemsInput(appids, options.cc, options.lang),
  });
  if (options.apiKey) params.set("key", options.apiKey);
  return `${GET_ITEMS_URL}?${params.toString()}`;
}

export async function fetchStoreItems(
  appids: number[],
  options: StoreBrowseOptions,
): Promise<StoreBrowseResult> {
  const items = new Map<number, RawStoreItem>();
  const unique = [...new Set(appids)].filter((id) => Number.isInteger(id) && id > 0);
  if (unique.length === 0) return { items, supported: true };

  const deadline = options.deadline ?? Number.POSITIVE_INFINITY;
  let supported = true;
  let firstChunkFailed = false;
  let chunkIndex = 0;

  await pool(chunk(unique, BATCH), 2, async (batch) => {
    const index = chunkIndex++;
    if (!supported || Date.now() >= deadline) return;

    try {
      const body = await getJson<unknown>(buildUrl(batch, options), { revalidate: TTL });
      const parsed = parseStoreItems(body);

      if (!parsed) {
        // Формат не распознан — доверять сервису нельзя, уходим на appdetails.
        supported = false;
        return;
      }
      for (const [appid, item] of parsed) items.set(appid, item);
    } catch {
      // Первая же пачка не прошла — вероятно, сервис недоступен целиком.
      if (index === 0) firstChunkFailed = true;
    }
  });

  if (firstChunkFailed && items.size === 0) supported = false;
  return { items, supported };
}

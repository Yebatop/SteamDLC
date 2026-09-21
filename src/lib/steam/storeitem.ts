import type { DlcItem } from "./types";

/**
 * Разбор ответов IStoreBrowseService/GetItems — batch-метода витрины,
 * живущего на api.steampowered.com.
 *
 * Зачем он вообще: store.steampowered.com считает лимит запросов по IP,
 * и на общем адресе хостинга он исчерпан. Тот же магазин, но через
 * api.steampowered.com, отвечает стабильно и принимает десятки appid за раз.
 *
 * Формат ответа официально не описан, поэтому каждое поле читается защитно,
 * а нераспознанный ответ честно возвращает null — вызывающий код уходит на
 * appdetails.
 */

export interface RawStoreItem {
  id?: number;
  appid?: number;
  success?: number;
  visible?: boolean;
  name?: string;
  type?: number;
  is_free?: boolean;
  release?: {
    steam_release_date?: number;
    is_coming_soon?: boolean;
  };
  best_purchase_option?: {
    final_price_in_cents?: string | number;
    original_price_in_cents?: string | number;
    formatted_final_price?: string;
    formatted_original_price?: string;
    discount_pct?: number;
  };
  tags?: Array<{ name?: string }>;
  related_items?: { parent_appid?: number };
}

interface StoreItemsBody {
  response?: { store_items?: RawStoreItem[] };
}

/** Steam отдаёт суммы строками — приводим бережно. */
function cents(value: string | number | undefined): number | null {
  if (value === undefined || value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function releaseDate(raw: RawStoreItem): string {
  const seconds = raw.release?.steam_release_date;
  if (!seconds || !Number.isFinite(seconds)) return "";
  // ISO-дата сортируется лексикографически — в отличие от «15 May, 2023».
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

/**
 * Раскладывает ответ по appid. null означает, что формат не распознан:
 * лучше уйти на проверенный appdetails, чем молча отдать пустоту.
 */
export function parseStoreItems(body: unknown): Map<number, RawStoreItem> | null {
  const items = (body as StoreItemsBody | null)?.response?.store_items;
  if (!Array.isArray(items)) return null;

  const byAppid = new Map<number, RawStoreItem>();
  for (const item of items) {
    const appid = item?.appid ?? item?.id;
    if (typeof appid === "number" && appid > 0) byAppid.set(appid, item);
  }
  return byAppid;
}

/**
 * Превращает позицию магазина в элемент каталога.
 * null — данных не хватает, стоит переспросить через appdetails.
 */
export function toDlcItemFromStore(
  appid: number,
  parent: number,
  raw: RawStoreItem | undefined,
  currency: string,
): DlcItem | null {
  if (!raw) return null;

  const unavailable = raw.success !== undefined && raw.success !== 1;
  const free = raw.is_free === true;
  const coming = raw.release?.is_coming_soon === true;
  const option = raw.best_purchase_option;
  const final = cents(option?.final_price_in_cents);
  const initial = cents(option?.original_price_in_cents) ?? final;

  // Ни имени, ни цены — ответ бесполезен.
  if (!raw.name && final === null && !free && !unavailable) return null;

  return {
    id: appid,
    parent,
    name: raw.name?.trim() || `App ${appid}`,
    type: "dlc",
    free,
    coming,
    released: releaseDate(raw),
    currency: final === null ? null : currency,
    initial,
    final,
    discount: typeof option?.discount_pct === "number" ? option.discount_pct : 0,
    formatted: option?.formatted_final_price?.trim() ?? null,
    genres: (raw.tags ?? [])
      .map((tag) => tag.name?.trim() ?? "")
      .filter((value) => value.length > 0),
    features: [],
    unavailable: unavailable || (final === null && !free && !coming),
  };
}

/** Тело запроса GetItems: сервис принимает его как input_json в строке запроса. */
export function buildGetItemsInput(appids: number[], cc: string, lang: string): string {
  return JSON.stringify({
    ids: appids.map((appid) => ({ appid })),
    context: {
      language: lang,
      country_code: cc.toUpperCase(),
      steam_realm: 1,
    },
    data_request: {
      include_basic_info: true,
      include_release: true,
      include_tag_count: 5,
    },
  });
}

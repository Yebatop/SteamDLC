import type { DlcItem } from "./types";

/**
 * Разбор ответов store/api/appdetails. Модуль чистый и без рантайм-импортов:
 * одним и тем же кодом пользуются серверные маршруты и браузер, когда ходит
 * в витрину напрямую.
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

export type RawResponse = Record<string, { success?: boolean; data?: RawAppData } | undefined>;

export const STORE_APPDETAILS_URL = "https://store.steampowered.com/api/appdetails";

export function buildAppDetailsUrl(
  appids: number[],
  filters: string,
  cc: string,
  lang: string,
): string {
  const params = new URLSearchParams({
    appids: appids.join(","),
    filters,
    cc,
    l: lang,
  });
  return `${STORE_APPDETAILS_URL}?${params.toString()}`;
}

/** appid его DLC, только корректные значения. */
export function dlcIdsFrom(data: RawAppData | null | undefined): number[] {
  const ids = data?.dlc;
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
}

/** Приводит сырой ответ витрины к позиции каталога. */
export function toDlcItem(id: number, parent: number, data: RawAppData | null): DlcItem {
  if (!data) {
    return {
      id,
      parent,
      name: `App ${id}`,
      type: "unknown",
      free: false,
      coming: false,
      released: "",
      currency: null,
      initial: null,
      final: null,
      discount: 0,
      formatted: null,
      genres: [],
      features: [],
      unavailable: true,
    };
  }

  const price = data.price_overview;
  return {
    id,
    parent,
    name: data.name?.trim() || `App ${id}`,
    type: data.type ?? "dlc",
    free: data.is_free === true,
    coming: data.release_date?.coming_soon === true,
    released: data.release_date?.date?.trim() ?? "",
    currency: price?.currency ?? null,
    initial: typeof price?.initial === "number" ? price.initial : null,
    final: typeof price?.final === "number" ? price.final : null,
    discount: typeof price?.discount_percent === "number" ? price.discount_percent : 0,
    formatted: price?.final_formatted?.trim() ?? null,
    genres: (data.genres ?? [])
      .map((genre) => genre.description?.trim() ?? "")
      .filter((value) => value.length > 0),
    features: (data.categories ?? [])
      .map((category) => category.description?.trim() ?? "")
      .filter((value) => value.length > 0),
    // Бесплатное DLC цены не имеет — это не признак недоступности.
    unavailable: !price && data.is_free !== true && data.release_date?.coming_soon !== true,
  };
}

/**
 * Раскладывает ответ витрины по запрошенным appid.
 * `missing` — те, о которых витрина не сказала ничего (обрезанный батч).
 */
export function splitAppDetails(
  appids: number[],
  body: RawResponse,
): { data: Map<number, RawAppData | null>; missing: number[] } {
  const data = new Map<number, RawAppData | null>();
  const missing: number[] = [];

  for (const appid of appids) {
    const entry = body[String(appid)];
    if (!entry) {
      missing.push(appid);
      continue;
    }
    data.set(appid, entry.success === false || !entry.data ? null : entry.data);
  }

  return { data, missing };
}

/** В ответе есть хоть одно имя: признак того, что набор filters достаточный. */
export function hasNames(body: RawResponse): boolean {
  return Object.values(body).some((entry) => Boolean(entry?.data?.name));
}

export function hasPayload(body: RawResponse): boolean {
  return Object.values(body).some((entry) => entry?.success !== false && Boolean(entry?.data));
}

/**
 * Витрина может ответить успехом и пустыми данными — так она поступает с
 * набором filters, который формально принимает, но не понимает.
 */
export function looksEmpty(body: RawResponse): boolean {
  const entries = Object.values(body).filter((entry) => entry?.success !== false && entry?.data);
  return entries.length > 0 && entries.every((entry) => Object.keys(entry!.data!).length === 0);
}

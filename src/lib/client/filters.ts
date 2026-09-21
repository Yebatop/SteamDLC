import type { DlcItem, OwnedGame, PriceHistory } from "../steam/types";
import type { Ownership } from "./ownership";

export type SortKey =
  | "value"
  | "discount"
  | "price-asc"
  | "price-desc"
  | "playtime"
  | "released"
  | "name";

export interface FilterState {
  query: string;
  hideOwned: boolean;
  hideIgnored: boolean;
  hideComingSoon: boolean;
  hideUnavailable: boolean;
  hideFree: boolean;
  onlyDiscounted: boolean;
  onlyWishlist: boolean;
  onlyLowestEver: boolean;
  minPlaytimeHours: number;
  minDiscount: number;
  /** В основных единицах валюты (рублях, долларах), не в копейках. */
  maxPrice: number | null;
  genres: string[];
  types: string[];
  parentAppid: number | null;
  sort: SortKey;
  groupByGame: boolean;
  /** Плитка с обложками или компактный список. */
  view: "grid" | "list";
}

export const DEFAULT_FILTERS: FilterState = {
  query: "",
  hideOwned: true,
  hideIgnored: true,
  hideComingSoon: true,
  hideUnavailable: true,
  hideFree: false,
  onlyDiscounted: false,
  onlyWishlist: false,
  onlyLowestEver: false,
  minPlaytimeHours: 0,
  minDiscount: 0,
  maxPrice: null,
  genres: [],
  types: [],
  parentAppid: null,
  sort: "value",
  groupByGame: false,
  view: "grid",
};

export interface DlcRow {
  item: DlcItem;
  game: OwnedGame | null;
  gameName: string;
  playtimeHours: number;
  owned: boolean;
  wishlisted: boolean;
  ignored: boolean;
  history: PriceHistory | null;
  /** Текущая цена не выше минимальной за всю известную историю. */
  lowestEver: boolean;
}

export interface BuildInput {
  items: DlcItem[];
  games: OwnedGame[];
  ownership: Ownership;
  /** Отмеченные вручную как купленные — на случай, если userdata не импортирован. */
  bought: number[];
  histories: Record<number, PriceHistory>;
}

export function buildRows({ items, games, ownership, bought, histories }: BuildInput): DlcRow[] {
  const gameById = new Map(games.map((game) => [game.appid, game]));
  const ownedSet = new Set<number>([...ownership.owned, ...bought]);
  const wishlistSet = new Set(ownership.wishlist);
  const ignoredSet = new Set(ownership.ignored);

  return items.map((item) => {
    const game = gameById.get(item.parent) ?? null;
    const history = histories[item.id] ?? null;

    return {
      item,
      game,
      gameName: game?.name ?? "Неизвестная игра",
      playtimeHours: game ? Math.round(game.playtime / 6) / 10 : 0,
      owned: ownedSet.has(item.id),
      wishlisted: wishlistSet.has(item.id),
      ignored: ignoredSet.has(item.id),
      history,
      lowestEver:
        history?.min != null && item.final != null ? item.final <= history.min : false,
    };
  });
}

function matchesQuery(row: DlcRow, query: string): boolean {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    row.item.name.toLowerCase().includes(needle) ||
    row.gameName.toLowerCase().includes(needle) ||
    String(row.item.id) === needle
  );
}

export function applyFilters(rows: DlcRow[], filters: FilterState): DlcRow[] {
  return rows.filter((row) => {
    const { item } = row;

    if (filters.hideOwned && row.owned) return false;
    if (filters.hideIgnored && row.ignored) return false;
    if (filters.hideComingSoon && item.coming) return false;
    if (filters.hideUnavailable && item.unavailable) return false;
    if (filters.hideFree && item.free) return false;
    if (filters.onlyDiscounted && item.discount <= 0) return false;
    if (filters.onlyWishlist && !row.wishlisted) return false;
    if (filters.onlyLowestEver && !row.lowestEver) return false;
    if (filters.minDiscount > 0 && item.discount < filters.minDiscount) return false;
    if (filters.minPlaytimeHours > 0 && row.playtimeHours < filters.minPlaytimeHours) return false;
    if (filters.parentAppid !== null && item.parent !== filters.parentAppid) return false;

    if (filters.maxPrice !== null) {
      // Бесплатное проходит любой ценовой фильтр, «цены нет» — нет.
      if (!item.free) {
        if (item.final === null) return false;
        if (item.final > filters.maxPrice * 100) return false;
      }
    }

    if (filters.types.length > 0 && !filters.types.includes(item.type)) return false;
    if (filters.genres.length > 0 && !filters.genres.some((genre) => item.genres.includes(genre))) {
      return false;
    }

    return matchesQuery(row, filters.query);
  });
}

/** «Выгодность»: скидка, взвешенная по тому, сколько ты играл в базовую игру. */
function valueScore(row: DlcRow): number {
  const discount = row.item.discount;
  const playtimeWeight = Math.log10(row.playtimeHours + 10);
  const lowestBonus = row.lowestEver ? 15 : 0;
  const wishlistBonus = row.wishlisted ? 25 : 0;
  return (discount + lowestBonus + wishlistBonus) * playtimeWeight;
}

const PRICE_MAX = Number.MAX_SAFE_INTEGER;

export function sortRows(rows: DlcRow[], sort: SortKey): DlcRow[] {
  const sorted = [...rows];

  switch (sort) {
    case "discount":
      sorted.sort((a, b) => b.item.discount - a.item.discount || a.item.name.localeCompare(b.item.name));
      break;
    case "price-asc":
      sorted.sort((a, b) => (a.item.final ?? PRICE_MAX) - (b.item.final ?? PRICE_MAX));
      break;
    case "price-desc":
      sorted.sort((a, b) => (b.item.final ?? -1) - (a.item.final ?? -1));
      break;
    case "playtime":
      sorted.sort((a, b) => b.playtimeHours - a.playtimeHours || a.item.name.localeCompare(b.item.name));
      break;
    case "released":
      sorted.sort((a, b) => b.item.released.localeCompare(a.item.released));
      break;
    case "name":
      sorted.sort((a, b) => a.item.name.localeCompare(b.item.name));
      break;
    case "value":
    default:
      sorted.sort((a, b) => valueScore(b) - valueScore(a) || b.item.discount - a.item.discount);
      break;
  }

  return sorted;
}

export interface Stats {
  total: number;
  owned: number;
  shown: number;
  priced: number;
  /** Сумма текущих цен показанных DLC. */
  sum: number;
  /** Сумма без скидок. */
  sumFull: number;
  discounted: number;
  currency: string | null;
}

export function computeStats(all: DlcRow[], shown: DlcRow[]): Stats {
  let sum = 0;
  let sumFull = 0;
  let priced = 0;
  let discounted = 0;
  let currency: string | null = null;

  for (const row of shown) {
    const { item } = row;
    if (item.final === null) continue;
    priced += 1;
    sum += item.final;
    sumFull += item.initial ?? item.final;
    if (item.discount > 0) discounted += 1;
    currency ??= item.currency;
  }

  return {
    total: all.length,
    owned: all.filter((row) => row.owned).length,
    shown: shown.length,
    priced,
    sum,
    sumFull,
    discounted,
    currency,
  };
}

export function collectGenres(rows: DlcRow[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const genre of row.item.genres) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function collectTypes(rows: DlcRow[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.item.type, (counts.get(row.item.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

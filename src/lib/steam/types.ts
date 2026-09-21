/** Игра из библиотеки пользователя (Steam Web API, IPlayerService/GetOwnedGames). */
export interface OwnedGame {
  appid: number;
  name: string;
  /** Всего наиграно, минуты. */
  playtime: number;
  /** Наиграно за 2 недели, минуты. */
  playtime2w: number;
  /** Unix seconds, 0 если Steam не отдал. */
  lastPlayed: number;
}

/** Одно DLC с ценой в валюте выбранного региона. */
export interface DlcItem {
  id: number;
  /** appid родительской игры. */
  parent: number;
  name: string;
  /** "dlc", "music", "game", "demo", ... */
  type: string;
  free: boolean;
  /** Ещё не вышло (coming_soon). */
  coming: boolean;
  /** Дата выхода как её отдаёт Steam, строкой. */
  released: string;
  currency: string | null;
  /** Цена без скидки, в минимальных единицах валюты (копейки/центы). */
  initial: number | null;
  /** Цена со скидкой, в минимальных единицах валюты. */
  final: number | null;
  /** 0..100 */
  discount: number;
  /** Готовая строка цены от Steam, например "349 pуб.". */
  formatted: string | null;
  genres: string[];
  features: string[];
  /** Steam не отдал данные: нет в продаже в этом регионе, делистед или скрыто. */
  unavailable: boolean;
}

/** Ответ /api/library */
export interface LibraryResponse {
  steamId: string;
  games: OwnedGame[];
}

/** Одна точка истории цены. */
export interface PricePoint {
  /** YYYY-MM-DD */
  d: string;
  /** final, в минимальных единицах валюты */
  f: number;
  /** discount_percent */
  p: number;
}

/** Сводка истории по одному DLC. */
export interface PriceHistory {
  appid: number;
  min: number | null;
  minDate: string | null;
  points: PricePoint[];
}

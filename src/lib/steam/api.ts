import { fetchAppDetails } from "./appdetails.ts";
import { dlcIdsFrom, toDlcItem } from "./parse.ts";
import { SteamApiError } from "./errors.ts";
import { getJson } from "./http.ts";
import type { DlcItem, OwnedGame } from "./types";

/** Список DLC у игры меняется редко — держим сутки. */
const DLC_LIST_TTL = 60 * 60 * 24;
/** Цены меняются в начале распродаж — держим полчаса. */
const PRICE_TTL = 60 * 30;

const STEAMID64_RE = /^\d{17}$/;

/**
 * Принимает что угодно: SteamID64, ссылку на профиль, кастомный URL.
 * Кастомный URL требует ключа Web API.
 */
export async function resolveSteamId(input: string, apiKey: string | null): Promise<string> {
  const raw = input.trim();
  if (!raw) throw new SteamApiError("Не указан профиль Steam", "bad_steamid");

  if (STEAMID64_RE.test(raw)) return raw;

  const profileMatch = raw.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (profileMatch) return profileMatch[1];

  const vanityMatch = raw.match(/steamcommunity\.com\/id\/([^/?#]+)/i);
  const vanity = vanityMatch ? decodeURIComponent(vanityMatch[1]) : raw;

  if (/[^A-Za-z0-9_.-]/.test(vanity)) {
    throw new SteamApiError("Не похоже ни на SteamID64, ни на ссылку профиля", "bad_steamid");
  }
  if (!apiKey) {
    throw new SteamApiError(
      "Чтобы определить SteamID по короткой ссылке, нужен ключ Steam Web API. " +
        "Либо укажи SteamID64 (17 цифр) — его можно посмотреть в настройках профиля.",
      "no_key",
    );
  }

  const params = new URLSearchParams({ key: apiKey, vanityurl: vanity });
  const body = await getJson<{ response?: { success?: number; steamid?: string } }>(
    `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?${params.toString()}`,
  );

  const steamid = body.response?.steamid;
  if (body.response?.success !== 1 || !steamid) {
    throw new SteamApiError(`Профиль «${vanity}» не найден`, "vanity_not_found");
  }
  return steamid;
}

/** Библиотека пользователя вместе с наигранными часами. */
export async function fetchOwnedGames(steamId: string, apiKey: string): Promise<OwnedGame[]> {
  if (!apiKey) throw new SteamApiError("Нужен ключ Steam Web API", "no_key");
  if (!STEAMID64_RE.test(steamId)) throw new SteamApiError("Некорректный SteamID64", "bad_steamid");

  const params = new URLSearchParams({
    key: apiKey,
    steamid: steamId,
    include_appinfo: "1",
    include_played_free_games: "1",
    format: "json",
  });

  const body = await getJson<{
    response?: {
      game_count?: number;
      games?: Array<{
        appid?: number;
        name?: string;
        playtime_forever?: number;
        playtime_2weeks?: number;
        rtime_last_played?: number;
      }>;
    };
  }>(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?${params.toString()}`);

  const games = body.response?.games;
  if (!games) {
    // Steam отдаёт пустой объект и для закрытого профиля, и для пустой библиотеки.
    throw new SteamApiError(
      "Steam не отдал список игр. Обычно это значит, что в настройках приватности " +
        "профиля «Игровые данные» закрыты — поставь «Для всех» и повтори.",
      "private_profile",
    );
  }

  return games
    .filter((game): game is { appid: number } & typeof game => typeof game.appid === "number")
    .map((game) => ({
      appid: game.appid,
      name: game.name?.trim() || `App ${game.appid}`,
      playtime: game.playtime_forever ?? 0,
      playtime2w: game.playtime_2weeks ?? 0,
      lastPlayed: game.rtime_last_played ?? 0,
    }))
    .sort((a, b) => b.playtime - a.playtime);
}

/** Регион и язык витрины: всё, что нужно знать вызывающей стороне. */
export interface RegionOptions {
  cc: string;
  lang: string;
  /** Момент, после которого новые запросы к Steam не начинаем. */
  deadline?: number;
}

export interface DlcIdsResult {
  /** appid игры -> список appid её DLC. */
  dlc: Record<number, number[]>;
  /** Сколько игр не удалось опросить: данные неполные, и об этом надо сказать. */
  failed: number;
  /** Игры с окончательным результатом: остальные клиент попросит снова. */
  processed: number[];
  /** Steam ограничил частоту — продолжать имеет смысл после паузы. */
  throttled: boolean;
}

export async function fetchDlcIds(
  appids: number[],
  options: RegionOptions,
): Promise<DlcIdsResult> {
  const { data, failed, processed, throttled } = await fetchAppDetails(appids, {
    ...options,
    purpose: "dlcList",
    revalidate: DLC_LIST_TTL,
  });
  const dlc: Record<number, number[]> = {};

  for (const appid of processed) {
    const ids = dlcIdsFrom(data.get(appid));
    if (ids.length > 0) dlc[appid] = ids;
  }

  return { dlc, failed, processed, throttled };
}

export interface DlcItemsResult {
  items: DlcItem[];
  failed: number;
  /** DLC с окончательным результатом. */
  processed: number[];
  throttled: boolean;
}

/** Детали и цены для списка DLC. `parents` задаёт, к какой игре относится каждое DLC. */
export async function fetchDlcItems(
  parents: Record<number, number>,
  options: RegionOptions,
): Promise<DlcItemsResult> {
  const ids = Object.keys(parents).map(Number);
  const { data, failed, processed, throttled } = await fetchAppDetails(ids, {
    ...options,
    purpose: "item",
    revalidate: PRICE_TTL,
  });

  return {
    // Отдаём только то, что реально получили: остальное придёт следующей пачкой.
    items: processed.map((id) => toDlcItem(id, parents[id], data.get(id) ?? null)),
    failed,
    processed,
    throttled,
  };
}

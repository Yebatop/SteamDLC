import { dlcIdsFrom, splitAppDetails, toDlcItem, type RawAppData } from "../steam/parse";
import type { DlcItem, OwnedGame } from "../steam/types";
import { ApiError, postJson } from "./api";
import { directStatus, fetchAppDetailsDirect } from "./direct";

/**
 * Наборы полей для прямых запросов из браузера. Каскада здесь нет намеренно:
 * если витрина ответит не тем, уходим на сервер — там перебор наборов уже есть.
 */
const DIRECT_FILTERS = {
  dlcList: "basic",
  item: "basic,price_overview,release_date,genres,categories",
} as const;

export type SyncStage = "idle" | "library" | "dlc" | "items" | "done" | "paused" | "error";

export interface SyncState {
  stage: SyncStage;
  steamId: string;
  cc: string;
  lang: string;
  games: OwnedGame[];
  /** appid игры -> appid её DLC */
  dlcMap: Record<number, number[]>;
  /** Игры, про которые ещё не спрашивали список DLC. */
  gamesLeft: number[];
  /** DLC, для которых ещё не получены цены. */
  itemsLeft: number[];
  items: DlcItem[];
  error: string | null;
  /** Сколько appid Steam не отдал: данные неполные, и это видно в интерфейсе. */
  skipped: number;
  /** Пока не наступит этот момент, Steam всё равно откажет: ждём и продолжаем. */
  waitUntil: number;
  syncedAt: number;
}

/** По столько appid за запрос: компромисс между скоростью и таймаутом функции. */
const CHUNK = 40;
/** Меньше уже не имеет смысла: накладные расходы съедают выигрыш. */
const MIN_CHUNK = 5;

/** Сбой на стороне сервера или сети: пачка, возможно, просто велика. */
function isServerError(error: unknown): boolean {
  return error instanceof ApiError && (error.status >= 500 || error.status === 0);
}

export function emptySync(cc: string, lang: string): SyncState {
  return {
    stage: "idle",
    steamId: "",
    cc,
    lang,
    games: [],
    dlcMap: {},
    gamesLeft: [],
    itemsLeft: [],
    items: [],
    error: null,
    skipped: 0,
    waitUntil: 0,
    syncedAt: 0,
  };
}

/** Сколько дополнений уже найдено на первом шаге. */
export function discoveredDlcCount(state: SyncState): number {
  let count = 0;
  for (const ids of Object.values(state.dlcMap)) count += ids.length;
  return count;
}

export function syncProgress(state: SyncState): { done: number; total: number; label: string } {
  if (state.stage === "library" || state.stage === "idle") {
    return { done: 0, total: 1, label: "Получаю список игр" };
  }
  if (state.stage === "dlc") {
    const total = state.games.length || 1;
    return {
      done: total - state.gamesLeft.length,
      total,
      label: "Шаг 1 из 2: ищу дополнения у каждой игры",
    };
  }
  const total = state.items.length + state.itemsLeft.length || 1;
  return { done: state.items.length, total, label: "Шаг 2 из 2: загружаю цены дополнений" };
}

function parentIndex(dlcMap: Record<number, number[]>): Record<number, number> {
  const index: Record<number, number> = {};
  for (const [parent, ids] of Object.entries(dlcMap)) {
    for (const id of ids) index[id] = Number(parent);
  }
  return index;
}

interface DlcIdsResponse {
  dlc: Record<string, number[]>;
  failed?: number;
  /** appid, по которым сервер довёл дело до конца. */
  processed?: number[];
  /** Steam ограничил частоту: остаток пачки не обработан. */
  throttled?: boolean;
}

interface ItemsResponse {
  items: DlcItem[];
  failed?: number;
  processed?: number[];
  throttled?: boolean;
}

/**
 * Паузы при ограничении частоты. Окно у витрины — около пяти минут,
 * поэтому ждём всё дольше, а не долбимся с одинаковым интервалом.
 */
const THROTTLE_WAITS_MS = [60_000, 120_000, 300_000, 300_000, 300_000];

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export interface SyncOptions {
  profile: string;
  apiKey: string;
  onUpdate: (state: SyncState) => void;
  signal: AbortSignal;
}

/**
 * Возобновляемая синхронизация: состояние обновляется после каждой пачки,
 * поэтому её можно прервать (закрыть вкладку, поймать 429) и продолжить
 * с того же места, не теряя загруженное.
 */
export async function runSync(initial: SyncState, options: SyncOptions): Promise<SyncState> {
  let state: SyncState = { ...initial, error: null };
  /** Уменьшается, если сервер не успевает ответить на большую пачку. */
  let chunkSize = CHUNK;
  /** Сколько раз подряд упирались в ограничение частоты. */
  let throttleCount = 0;

  const commit = (patch: Partial<SyncState>) => {
    state = { ...state, ...patch };
    options.onUpdate(state);
    return state;
  };

  /**
   * Пробует забрать данные из витрины прямо из браузера. Возвращает null,
   * если это не удалось: дальше пойдёт обычный серверный путь.
   */
  const tryDirect = async (
    appids: number[],
    filters: string,
    expectNames: boolean,
  ): Promise<Map<number, RawAppData | null> | "throttled" | null> => {
    if (directStatus() === "blocked") return null;

    const result = await fetchAppDetailsDirect({
      appids,
      filters,
      cc: state.cc,
      lang: state.lang,
      signal: options.signal,
      expectNames,
    });

    if (!result.ok) return result.reason === "rate-limited" ? "throttled" : null;

    const { data, missing } = splitAppDetails(appids, result.body);
    // Витрина ответила не про все appid — досылать по одному умеет сервер.
    return missing.length > 0 ? null : data;
  };

  /**
   * Ждёт окончания ограничения частоты. Возвращает false, если ждать больше
   * незачем: превышен лимит попыток или синхронизацию прервали.
   */
  const waitOutThrottle = async (): Promise<boolean> => {
    if (throttleCount >= THROTTLE_WAITS_MS.length) return false;

    const waitMs = THROTTLE_WAITS_MS[throttleCount];
    throttleCount += 1;

    const until = Date.now() + waitMs;
    commit({ waitUntil: until });
    await sleep(waitMs, options.signal);
    commit({ waitUntil: 0 });

    return !options.signal.aborted;
  };

  try {
    if (state.stage === "idle" || state.games.length === 0) {
      commit({ stage: "library", skipped: 0 });
      const library = await postJson<{ steamId: string; games: OwnedGame[] }>(
        "/api/library",
        { profile: options.profile, apiKey: options.apiKey || undefined },
        options.signal,
      );
      commit({
        stage: "dlc",
        steamId: library.steamId,
        games: library.games,
        gamesLeft: library.games.map((game) => game.appid),
        dlcMap: {},
        items: [],
        itemsLeft: [],
      });
    }

    while (state.gamesLeft.length > 0) {
      if (options.signal.aborted) return commit({ stage: "paused" });

      const batch = state.gamesLeft.slice(0, chunkSize);

      const direct = await tryDirect(batch, DIRECT_FILTERS.dlcList, false);
      if (direct === "throttled") {
        if (!(await waitOutThrottle())) break;
        continue;
      }
      if (direct) {
        const dlcMap = { ...state.dlcMap };
        for (const [appid, data] of direct) {
          const ids = dlcIdsFrom(data);
          if (ids.length > 0) dlcMap[appid] = ids;
        }
        const handled = new Set(direct.keys());
        commit({
          stage: "dlc",
          dlcMap,
          gamesLeft: state.gamesLeft.filter((appid) => !handled.has(appid)),
        });
        continue;
      }

      let response: DlcIdsResponse;

      try {
        response = await postJson<DlcIdsResponse>(
          "/api/dlc-ids",
          { appids: batch, cc: state.cc, lang: state.lang },
          options.signal,
        );
      } catch (error) {
        // Сервер не уложился в свой таймаут — просим меньшую пачку.
        if (isServerError(error) && chunkSize > MIN_CHUNK) {
          chunkSize = Math.max(MIN_CHUNK, Math.floor(chunkSize / 2));
          continue;
        }
        // Ограничение частоты — не повод бросать: переждём и вернёмся сюда же.
        if (error instanceof ApiError && error.rateLimited && (await waitOutThrottle())) {
          continue;
        }
        throw error;
      }

      // Сервер отдаёт ровно то, что успел: остальное запросим следующим шагом.
      const done = new Set(response.processed ?? batch);
      if (done.size === 0) {
        if (chunkSize > MIN_CHUNK) {
          chunkSize = Math.max(MIN_CHUNK, Math.floor(chunkSize / 2));
          continue;
        }
        throw new ApiError("Steam не успевает отвечать — попробуй позже", 504);
      }

      const dlcMap = { ...state.dlcMap };
      for (const [appid, ids] of Object.entries(response.dlc)) {
        dlcMap[Number(appid)] = ids;
      }
      commit({
        stage: "dlc",
        dlcMap,
        gamesLeft: state.gamesLeft.filter((appid) => !done.has(appid)),
        skipped: state.skipped + (response.failed ?? 0),
      });

      if (response.throttled && state.gamesLeft.length > 0) {
        if (!(await waitOutThrottle())) break;
      }
    }

    if (state.itemsLeft.length === 0 && state.items.length === 0) {
      const all = Object.values(state.dlcMap).flat();
      commit({ stage: "items", itemsLeft: [...new Set(all)] });
    }

    while (state.itemsLeft.length > 0) {
      if (options.signal.aborted) return commit({ stage: "paused" });

      const batch = state.itemsLeft.slice(0, chunkSize);
      const parents = parentIndex(state.dlcMap);
      const payload: Record<number, number> = {};
      for (const id of batch) payload[id] = parents[id] ?? 0;

      const direct = await tryDirect(batch, DIRECT_FILTERS.item, true);
      if (direct === "throttled") {
        if (!(await waitOutThrottle())) break;
        continue;
      }
      if (direct) {
        const handled = new Set(direct.keys());
        commit({
          stage: "items",
          items: [
            ...state.items,
            ...[...direct].map(([id, data]) => toDlcItem(id, parents[id] ?? 0, data)),
          ],
          itemsLeft: state.itemsLeft.filter((id) => !handled.has(id)),
        });
        continue;
      }

      let response: ItemsResponse;

      try {
        response = await postJson<ItemsResponse>(
          "/api/items",
          {
            parents: payload,
            cc: state.cc,
            lang: state.lang,
            apiKey: options.apiKey || undefined,
          },
          options.signal,
        );
      } catch (error) {
        if (isServerError(error) && chunkSize > MIN_CHUNK) {
          chunkSize = Math.max(MIN_CHUNK, Math.floor(chunkSize / 2));
          continue;
        }
        if (error instanceof ApiError && error.rateLimited && (await waitOutThrottle())) {
          continue;
        }
        throw error;
      }

      const done = new Set(response.processed ?? batch);
      if (done.size === 0) {
        if (chunkSize > MIN_CHUNK) {
          chunkSize = Math.max(MIN_CHUNK, Math.floor(chunkSize / 2));
          continue;
        }
        throw new ApiError("Steam не успевает отвечать — попробуй позже", 504);
      }

      commit({
        stage: "items",
        items: [...state.items, ...response.items],
        itemsLeft: state.itemsLeft.filter((id) => !done.has(id)),
        skipped: state.skipped + (response.failed ?? 0),
      });

      if (response.throttled && state.itemsLeft.length > 0) {
        if (!(await waitOutThrottle())) break;
      }
    }

    if (state.gamesLeft.length > 0 || state.itemsLeft.length > 0) {
      return commit({
        stage: "paused",
        waitUntil: 0,
        error:
          "Steam долго держит ограничение частоты. Загруженное сохранено — " +
          "нажми «Продолжить» через несколько минут.",
      });
    }

    return commit({ stage: "done", syncedAt: Date.now(), waitUntil: 0, error: null });
  } catch (error) {
    if (options.signal.aborted) return commit({ stage: "paused" });

    if (error instanceof ApiError && error.rateLimited) {
      return commit({
        stage: "paused",
        waitUntil: 0,
        error:
          "Steam ограничил частоту запросов. Подожди пару минут и нажми «Продолжить» — " +
          "загруженное уже сохранено.",
      });
    }

    return commit({
      stage: "error",
      error: error instanceof Error ? error.message : "Не удалось синхронизировать",
    });
  }
}

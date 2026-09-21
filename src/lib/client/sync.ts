import type { DlcItem, OwnedGame } from "../steam/types";
import { ApiError, postJson } from "./api";

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
  syncedAt: number;
}

/** По столько appid за запрос: компромисс между скоростью и таймаутом функции. */
const CHUNK = 40;

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
    syncedAt: 0,
  };
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
      label: "Ищу DLC у каждой игры",
    };
  }
  const total = state.items.length + state.itemsLeft.length || 1;
  return { done: state.items.length, total, label: "Загружаю цены DLC" };
}

function parentIndex(dlcMap: Record<number, number[]>): Record<number, number> {
  const index: Record<number, number> = {};
  for (const [parent, ids] of Object.entries(dlcMap)) {
    for (const id of ids) index[id] = Number(parent);
  }
  return index;
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

  const commit = (patch: Partial<SyncState>) => {
    state = { ...state, ...patch };
    options.onUpdate(state);
    return state;
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

      const batch = state.gamesLeft.slice(0, CHUNK);
      const response = await postJson<{ dlc: Record<string, number[]>; failed?: number }>(
        "/api/dlc-ids",
        { appids: batch, cc: state.cc, lang: state.lang },
        options.signal,
      );

      const dlcMap = { ...state.dlcMap };
      for (const [appid, ids] of Object.entries(response.dlc)) {
        dlcMap[Number(appid)] = ids;
      }
      commit({
        stage: "dlc",
        dlcMap,
        gamesLeft: state.gamesLeft.slice(batch.length),
        skipped: state.skipped + (response.failed ?? 0),
      });
    }

    if (state.itemsLeft.length === 0 && state.items.length === 0) {
      const all = Object.values(state.dlcMap).flat();
      commit({ stage: "items", itemsLeft: [...new Set(all)] });
    }

    while (state.itemsLeft.length > 0) {
      if (options.signal.aborted) return commit({ stage: "paused" });

      const batch = state.itemsLeft.slice(0, CHUNK);
      const parents = parentIndex(state.dlcMap);
      const payload: Record<number, number> = {};
      for (const id of batch) payload[id] = parents[id] ?? 0;

      const response = await postJson<{ items: DlcItem[]; failed?: number }>(
        "/api/items",
        { parents: payload, cc: state.cc, lang: state.lang },
        options.signal,
      );

      commit({
        stage: "items",
        items: [...state.items, ...response.items],
        itemsLeft: state.itemsLeft.slice(batch.length),
        skipped: state.skipped + (response.failed ?? 0),
      });
    }

    return commit({ stage: "done", syncedAt: Date.now(), error: null });
  } catch (error) {
    if (options.signal.aborted) return commit({ stage: "paused" });

    if (error instanceof ApiError && error.rateLimited) {
      return commit({
        stage: "paused",
        error:
          "Steam ограничил частоту запросов. Подожди минуту и нажми «Продолжить» — " +
          "загруженное уже сохранено.",
      });
    }

    return commit({
      stage: "error",
      error: error instanceof Error ? error.message : "Не удалось синхронизировать",
    });
  }
}

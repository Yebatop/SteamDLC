"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PriceHistory } from "@/lib/steam/types";
import { postJson } from "@/lib/client/api";
import {
  applyFilters,
  buildRows,
  collectGenres,
  collectTypes,
  computeStats,
  sortRows,
  DEFAULT_FILTERS,
  type FilterState,
} from "@/lib/client/filters";
import { EMPTY_OWNERSHIP, type Ownership } from "@/lib/client/ownership";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/client/settings";
import { clearAll, KEYS, loadJson, saveJson } from "@/lib/client/storage";
import { emptySync, runSync, type SyncState } from "@/lib/client/sync";
import BuyQueue from "./BuyQueue";
import Dashboard from "./Dashboard";
import Onboarding from "./Onboarding";
import SettingsDialog from "./SettingsDialog";
import SyncBar from "./SyncBar";
import WatchDialog from "./WatchDialog";
import { Button } from "./ui";

type Dialog = null | "buy" | "watch" | "settings";

export default function App() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [sync, setSync] = useState<SyncState>(() =>
    emptySync(DEFAULT_SETTINGS.cc, DEFAULT_SETTINGS.lang),
  );
  const [ownership, setOwnership] = useState<Ownership>(EMPTY_OWNERSHIP);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selection, setSelection] = useState<number[]>([]);
  const [bought, setBought] = useState<number[]>([]);
  const [histories, setHistories] = useState<Record<number, PriceHistory>>({});
  const [dialog, setDialog] = useState<Dialog>(null);
  const [running, setRunning] = useState(false);
  const [watchToken, setWatchToken] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const syncRef = useRef(sync);
  syncRef.current = sync;

  /* --- загрузка состояния из localStorage ---------------------------------- */
  useEffect(() => {
    const storedSettings = loadJson<Settings>(KEYS.settings, DEFAULT_SETTINGS);
    setSettings(storedSettings);
    setSync(loadJson<SyncState>(KEYS.sync, emptySync(storedSettings.cc, storedSettings.lang)));
    setOwnership(loadJson<Ownership>(KEYS.ownership, EMPTY_OWNERSHIP));
    setFilters({ ...DEFAULT_FILTERS, ...loadJson<Partial<FilterState>>(KEYS.filters, {}) });
    setSelection(loadJson<number[]>(KEYS.selection, []));
    setBought(loadJson<number[]>(KEYS.bought, []));

    let token = loadJson<string>(KEYS.watchToken, "");
    if (!token) {
      token =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      saveJson(KEYS.watchToken, token);
    }
    setWatchToken(token);
    setReady(true);
  }, []);

  /* --- сохранение ---------------------------------------------------------- */
  useEffect(() => {
    if (ready) saveJson(KEYS.settings, settings);
  }, [ready, settings]);
  useEffect(() => {
    if (ready) saveJson(KEYS.sync, sync);
  }, [ready, sync]);
  useEffect(() => {
    if (ready) saveJson(KEYS.ownership, ownership);
  }, [ready, ownership]);
  useEffect(() => {
    if (ready) saveJson(KEYS.filters, filters);
  }, [ready, filters]);
  useEffect(() => {
    if (ready) saveJson(KEYS.selection, selection);
  }, [ready, selection]);
  useEffect(() => {
    if (ready) saveJson(KEYS.bought, bought);
  }, [ready, bought]);

  /* --- история цен --------------------------------------------------------- */
  const loadHistories = useCallback(async (state: SyncState) => {
    const appids = state.items
      .filter((item) => item.final !== null)
      .map((item) => item.id);
    if (appids.length === 0) return;

    const collected: Record<number, PriceHistory> = {};
    for (let i = 0; i < appids.length; i += 400) {
      try {
        const response = await postJson<{ histories: PriceHistory[] }>("/api/history", {
          appids: appids.slice(i, i + 400),
          cc: state.cc,
        });
        for (const history of response.histories) {
          if (history.points.length > 0) collected[history.appid] = history;
        }
      } catch {
        // История — необязательная надстройка: молча продолжаем без неё.
        return;
      }
    }
    setHistories(collected);
  }, []);

  /* --- синхронизация ------------------------------------------------------- */
  const start = useCallback(
    async (fresh: boolean) => {
      if (running) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(true);

      const base = fresh
        ? emptySync(settings.cc, settings.lang)
        : { ...syncRef.current, cc: settings.cc, lang: settings.lang };

      const final = await runSync(base, {
        profile: settings.profile,
        apiKey: settings.apiKey,
        onUpdate: setSync,
        signal: controller.signal,
      });

      setRunning(false);
      if (final.stage === "done") void loadHistories(final);
    },
    [loadHistories, running, settings],
  );

  const pause = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  useEffect(() => {
    if (ready && sync.stage === "done" && sync.items.length > 0) {
      void loadHistories(sync);
    }
    // Загружаем историю один раз после готовности данных.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sync.stage]);

  /* --- производные данные --------------------------------------------------- */
  const rows = useMemo(
    () =>
      buildRows({
        items: sync.items,
        games: sync.games,
        ownership,
        bought,
        histories,
      }),
    [sync.items, sync.games, ownership, bought, histories],
  );

  const filtered = useMemo(
    () => sortRows(applyFilters(rows, filters), filters.sort),
    [rows, filters],
  );
  const stats = useMemo(() => computeStats(rows, filtered), [rows, filtered]);
  const genres = useMemo(() => collectGenres(rows), [rows]);
  const types = useMemo(() => collectTypes(rows), [rows]);
  const selectedRows = useMemo(() => {
    const ids = new Set(selection);
    return rows.filter((row) => ids.has(row.item.id));
  }, [rows, selection]);

  const parentName = useMemo(
    () =>
      filters.parentAppid === null
        ? null
        : (sync.games.find((game) => game.appid === filters.parentAppid)?.name ?? null),
    [filters.parentAppid, sync.games],
  );

  const markBought = useCallback((appid: number) => {
    setBought((current) => (current.includes(appid) ? current : [...current, appid]));
    setSelection((current) => current.filter((id) => id !== appid));
  }, []);

  const reset = useCallback(() => {
    clearAll();
    setSettings(DEFAULT_SETTINGS);
    setSync(emptySync(DEFAULT_SETTINGS.cc, DEFAULT_SETTINGS.lang));
    setOwnership(EMPTY_OWNERSHIP);
    setFilters(DEFAULT_FILTERS);
    setSelection([]);
    setBought([]);
    setHistories({});
    setDialog(null);
  }, []);

  // До чтения localStorage рисуем скелетон: рендерить данные на сервере нечем,
  // а пустой экран выглядел бы как сломавшаяся страница.
  if (!ready) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="h-8 w-72 animate-pulse rounded bg-panel" />
        <div className="mt-3 h-4 w-96 animate-pulse rounded bg-panel/70" />
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="h-80 animate-pulse rounded-lg bg-panel" />
          <div className="h-80 animate-pulse rounded-lg bg-panel" />
        </div>
      </main>
    );
  }

  const hasData = sync.games.length > 0;

  if (!hasData) {
    return (
      <main>
        <Onboarding
          settings={settings}
          onChange={setSettings}
          ownership={ownership}
          onImport={setOwnership}
          onStart={() => void start(true)}
          busy={running}
          error={sync.error}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">SteamDLC</h1>
          <p className="text-xs text-muted">
            {sync.syncedAt > 0
              ? `Обновлено ${new Date(sync.syncedAt).toLocaleString("ru-RU")}`
              : "Данные ещё не полные"}
            {ownership.importedAt === 0 ? " · список купленного не импортирован" : ""}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={() => void start(true)} disabled={running}>
            {running ? "Обновляю…" : "Обновить"}
          </Button>
          <Button variant="ghost" onClick={() => setDialog("settings")}>
            Настройки
          </Button>
        </div>
      </header>

      <div className="space-y-4">
        <SyncBar
          state={sync}
          running={running}
          onStart={() => void start(false)}
          onPause={pause}
        />

        <Dashboard
          rows={rows}
          filtered={filtered}
          stats={stats}
          gamesCount={sync.games.length}
          filters={filters}
          onFilters={setFilters}
          genres={genres}
          types={types}
          parentName={parentName}
          currencyLabel={stats.currency ?? ""}
          selection={selection}
          onToggleSelect={(appid) =>
            setSelection((current) =>
              current.includes(appid)
                ? current.filter((id) => id !== appid)
                : [...current, appid],
            )
          }
          onSelectVisible={(appids) =>
            setSelection((current) => [...new Set([...current, ...appids])])
          }
          onClearSelection={() => setSelection([])}
          onMarkBought={markBought}
          onOpenBuyQueue={() => setDialog("buy")}
          onOpenWatch={() => setDialog("watch")}
        />
      </div>

      {dialog === "buy" ? (
        <BuyQueue
          rows={selectedRows}
          onMarkBought={markBought}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === "watch" ? (
        <WatchDialog
          rows={selectedRows}
          settings={settings}
          token={watchToken}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === "settings" ? (
        <SettingsDialog
          settings={settings}
          onChange={setSettings}
          ownership={ownership}
          onImport={setOwnership}
          onResync={() => {
            setDialog(null);
            void start(true);
          }}
          onReset={reset}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </main>
  );
}

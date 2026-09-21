"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";
import { plural } from "@/lib/plural";
import type { DlcRow, FilterState, Stats } from "@/lib/client/filters";
import DlcCard from "./DlcCard";
import DlcRowItem from "./DlcRow";
import FiltersPanel from "./FiltersPanel";
import StatsRow from "./StatsRow";
import { Button } from "./ui";

const PAGE = 60;

export default function Dashboard({
  rows,
  filtered,
  stats,
  gamesCount,
  filters,
  onFilters,
  genres,
  types,
  parentName,
  currencyLabel,
  selection,
  onToggleSelect,
  onSelectVisible,
  onClearSelection,
  onMarkBought,
  onOpenBuyQueue,
  onOpenWatch,
}: {
  rows: DlcRow[];
  filtered: DlcRow[];
  stats: Stats;
  gamesCount: number;
  filters: FilterState;
  onFilters: (filters: FilterState) => void;
  genres: Array<{ name: string; count: number }>;
  types: Array<{ name: string; count: number }>;
  parentName: string | null;
  currencyLabel: string;
  selection: number[];
  onToggleSelect: (appid: number) => void;
  onSelectVisible: (appids: number[]) => void;
  onClearSelection: () => void;
  onMarkBought: (appid: number) => void;
  onOpenBuyQueue: () => void;
  onOpenWatch: () => void;
}) {
  const [visible, setVisible] = useState(PAGE);
  useEffect(() => setVisible(PAGE), [filters]);

  const selected = useMemo(() => new Set(selection), [selection]);
  const page = filtered.slice(0, visible);
  const grid = filters.view === "grid";

  const groups = useMemo(() => {
    if (!filters.groupByGame) return null;
    const map = new Map<string, DlcRow[]>();
    for (const row of page) {
      const list = map.get(row.gameName) ?? [];
      list.push(row);
      map.set(row.gameName, list);
    }
    return [...map.entries()];
  }, [page, filters.groupByGame]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(row.item.id)),
    [rows, selected],
  );
  const selectedSum = selectedRows.reduce((sum, row) => sum + (row.item.final ?? 0), 0);
  const selectedCurrency = selectedRows.find((row) => row.item.currency)?.item.currency ?? null;

  const renderRow = (row: DlcRow) => {
    const props = {
      row,
      selected: selected.has(row.item.id),
      onToggle: () => onToggleSelect(row.item.id),
      onMarkBought: () => onMarkBought(row.item.id),
      onPickGame: () => onFilters({ ...filters, parentAppid: row.item.parent }),
    };
    return grid ? (
      <DlcCard key={row.item.id} {...props} />
    ) : (
      <DlcRowItem key={row.item.id} {...props} />
    );
  };

  const wrap = (children: React.ReactNode) =>
    grid ? (
      <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {children}
      </div>
    ) : (
      <div>{children}</div>
    );

  return (
    <div className="space-y-4 pb-28">
      <StatsRow stats={stats} games={gamesCount} />

      <FiltersPanel
        filters={filters}
        onChange={onFilters}
        genres={genres}
        types={types}
        parentName={parentName}
        currencyLabel={currencyLabel}
      />

      <div className="overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-raised/30 px-3.5 py-2.5 text-xs text-muted">
          <span>
            Показано {page.length} из {filtered.length}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onSelectVisible(page.filter((row) => !row.owned).map((row) => row.item.id))
              }
              className="rounded-md px-2 py-1 transition-colors hover:bg-raised hover:text-steam"
            >
              Выбрать всё на экране
            </button>

            <div className="flex rounded-lg border border-line p-0.5">
              {(["grid", "list"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onFilters({ ...filters, view: mode })}
                  className={`rounded-md px-2.5 py-1 transition-colors ${
                    filters.view === mode
                      ? "bg-steam-dim/30 text-steam"
                      : "text-muted hover:text-slate-200"
                  }`}
                >
                  {mode === "grid" ? "Плитка" : "Список"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="text-sm text-slate-300">Ничего не найдено</div>
            <div className="mx-auto mt-1 max-w-sm text-xs text-muted">
              Попробуй ослабить фильтры — например, выключить «Скрыть купленные» или
              «Скрыть недоступное в регионе».
            </div>
          </div>
        ) : null}

        {groups
          ? groups.map(([gameName, list]) => (
              <div key={gameName}>
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-raised px-3.5 py-2 text-xs font-semibold text-slate-200">
                  <span className="truncate">{gameName}</span>
                  <span className="shrink-0 text-muted">
                    {list.length}{" "}
                    {plural(list.length, "дополнение", "дополнения", "дополнений")} ·{" "}
                    {formatMoney(
                      list.reduce((sum, row) => sum + (row.item.final ?? 0), 0),
                      list[0]?.item.currency ?? null,
                    )}
                  </span>
                </div>
                {wrap(list.map(renderRow))}
              </div>
            ))
          : wrap(page.map(renderRow))}

        {visible < filtered.length ? (
          <div className="flex justify-center gap-2 border-t border-line p-3">
            <Button onClick={() => setVisible(visible + PAGE)}>Показать ещё {PAGE}</Button>
            <Button variant="ghost" onClick={() => setVisible(filtered.length)}>
              Показать все ({filtered.length})
            </Button>
          </div>
        ) : null}
      </div>

      {selection.length > 0 ? (
        <div className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
            <span className="text-sm text-slate-200">
              Выбрано <b>{selection.length}</b> · Итого{" "}
              <b className="text-sale">{formatMoney(selectedSum, selectedCurrency)}</b>
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="primary" onClick={onOpenBuyQueue}>
                Очередь покупок
              </Button>
              <Button onClick={onOpenWatch}>Следить за ценой</Button>
              <Button variant="ghost" onClick={onClearSelection}>
                Снять выделение
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

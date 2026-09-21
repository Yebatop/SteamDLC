"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";
import type { DlcRow, FilterState, Stats } from "@/lib/client/filters";
import DlcRowItem from "./DlcRow";
import FiltersPanel from "./FiltersPanel";
import StatsRow from "./StatsRow";
import { Button } from "./ui";

const PAGE = 100;

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

  return (
    <div className="space-y-4 pb-24">
      <StatsRow stats={stats} games={gamesCount} />

      <FiltersPanel
        filters={filters}
        onChange={onFilters}
        genres={genres}
        types={types}
        parentName={parentName}
        currencyLabel={currencyLabel}
      />

      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line bg-raised/40 px-3 py-2 text-xs text-muted">
          <span>
            Показано {page.length} из {filtered.length}
          </span>
          <button
            type="button"
            onClick={() => onSelectVisible(page.filter((row) => !row.owned).map((row) => row.item.id))}
            className="hover:text-steam"
          >
            Выбрать всё на экране
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted">
            Ничего не найдено. Попробуй ослабить фильтры — например, выключить «Скрыть купленные»
            или «Скрыть недоступное в регионе».
          </div>
        ) : null}

        {groups
          ? groups.map(([gameName, list]) => (
              <div key={gameName}>
                <div className="sticky top-0 z-10 flex items-center justify-between bg-raised px-3 py-1.5 text-xs font-semibold text-slate-300">
                  <span className="truncate">{gameName}</span>
                  <span className="text-muted">
                    {list.length} ·{" "}
                    {formatMoney(
                      list.reduce((sum, row) => sum + (row.item.final ?? 0), 0),
                      list[0]?.item.currency ?? null,
                    )}
                  </span>
                </div>
                {list.map((row) => (
                  <DlcRowItem
                    key={row.item.id}
                    row={row}
                    selected={selected.has(row.item.id)}
                    onToggle={() => onToggleSelect(row.item.id)}
                    onMarkBought={() => onMarkBought(row.item.id)}
                    onPickGame={() => onFilters({ ...filters, parentAppid: row.item.parent })}
                  />
                ))}
              </div>
            ))
          : page.map((row) => (
              <DlcRowItem
                key={row.item.id}
                row={row}
                selected={selected.has(row.item.id)}
                onToggle={() => onToggleSelect(row.item.id)}
                onMarkBought={() => onMarkBought(row.item.id)}
                onPickGame={() => onFilters({ ...filters, parentAppid: row.item.parent })}
              />
            ))}

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
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur">
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

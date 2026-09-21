"use client";

import { useState } from "react";
import type { FilterState, SortKey } from "@/lib/client/filters";
import { Button, TextInput, Toggle } from "./ui";

const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "value", label: "Сначала выгодное" },
  { key: "discount", label: "По скидке" },
  { key: "price-asc", label: "Дешёвые сверху" },
  { key: "price-desc", label: "Дорогие сверху" },
  { key: "playtime", label: "По наигранным часам" },
  { key: "released", label: "Сначала новые" },
  { key: "name", label: "По названию" },
];

export default function FiltersPanel({
  filters,
  onChange,
  genres,
  types,
  parentName,
  currencyLabel,
}: {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  genres: Array<{ name: string; count: number }>;
  types: Array<{ name: string; count: number }>;
  parentName: string | null;
  currencyLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const patch = (next: Partial<FilterState>) => onChange({ ...filters, ...next });

  const toggleInList = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  return (
    <div className="space-y-3 rounded-lg border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <TextInput
            value={filters.query}
            onChange={(query) => patch({ query })}
            placeholder="Поиск по DLC или игре…"
          />
        </div>

        <select
          value={filters.sort}
          onChange={(event) => patch({ sort: event.target.value as SortKey })}
          className="rounded border border-line bg-ink px-3 py-2 text-sm text-slate-100 outline-none focus:border-steam"
        >
          {SORTS.map((sort) => (
            <option key={sort.key} value={sort.key}>
              {sort.label}
            </option>
          ))}
        </select>

        <Button variant="ghost" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Свернуть фильтры" : "Ещё фильтры"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <Toggle
          checked={filters.hideOwned}
          onChange={(hideOwned) => patch({ hideOwned })}
          label="Скрыть купленные"
        />
        <Toggle
          checked={filters.onlyDiscounted}
          onChange={(onlyDiscounted) => patch({ onlyDiscounted })}
          label="Только со скидкой"
        />
        <Toggle
          checked={filters.onlyWishlist}
          onChange={(onlyWishlist) => patch({ onlyWishlist })}
          label="Только из вишлиста"
        />
        <Toggle
          checked={filters.onlyLowestEver}
          onChange={(onlyLowestEver) => patch({ onlyLowestEver })}
          label="Минимум цены"
          hint="Текущая цена не выше минимальной за всю известную историю"
        />
        <Toggle
          checked={filters.groupByGame}
          onChange={(groupByGame) => patch({ groupByGame })}
          label="Группировать по играм"
        />
      </div>

      {parentName ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Только игра:</span>
          <span className="font-medium text-slate-100">{parentName}</span>
          <Button variant="ghost" onClick={() => patch({ parentAppid: null })}>
            сбросить
          </Button>
        </div>
      ) : null}

      {expanded ? (
        <div className="space-y-4 border-t border-line pt-3">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-slate-300">
                Скидка от: <b className="text-steam">{filters.minDiscount}%</b>
              </span>
              <input
                type="range"
                min={0}
                max={95}
                step={5}
                value={filters.minDiscount}
                onChange={(event) => patch({ minDiscount: Number(event.target.value) })}
                className="w-full"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-slate-300">
                Наиграно от:{" "}
                <b className="text-steam">
                  {filters.minPlaytimeHours === 0 ? "любое" : `${filters.minPlaytimeHours} ч`}
                </b>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={filters.minPlaytimeHours}
                onChange={(event) => patch({ minPlaytimeHours: Number(event.target.value) })}
                className="w-full"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="text-slate-300">Цена не выше ({currencyLabel})</span>
              <input
                type="number"
                min={0}
                value={filters.maxPrice ?? ""}
                placeholder="без ограничения"
                onChange={(event) =>
                  patch({ maxPrice: event.target.value === "" ? null : Number(event.target.value) })
                }
                className="w-full rounded border border-line bg-ink px-3 py-2 text-sm text-slate-100 outline-none focus:border-steam"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Toggle
              checked={filters.hideComingSoon}
              onChange={(hideComingSoon) => patch({ hideComingSoon })}
              label="Скрыть «скоро выйдет»"
            />
            <Toggle
              checked={filters.hideUnavailable}
              onChange={(hideUnavailable) => patch({ hideUnavailable })}
              label="Скрыть недоступное в регионе"
            />
            <Toggle
              checked={filters.hideFree}
              onChange={(hideFree) => patch({ hideFree })}
              label="Скрыть бесплатное"
            />
            <Toggle
              checked={filters.hideIgnored}
              onChange={(hideIgnored) => patch({ hideIgnored })}
              label="Скрыть «скрытое» в Steam"
            />
          </div>

          {types.length > 1 ? (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold tracking-wide text-muted uppercase">Тип</div>
              <div className="flex flex-wrap gap-1.5">
                {types.map((type) => (
                  <Chip
                    key={type.name}
                    active={filters.types.includes(type.name)}
                    onClick={() => patch({ types: toggleInList(filters.types, type.name) })}
                  >
                    {type.name} · {type.count}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}

          {genres.length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold tracking-wide text-muted uppercase">Жанры</div>
              <div className="flex flex-wrap gap-1.5">
                {genres.slice(0, 24).map((genre) => (
                  <Chip
                    key={genre.name}
                    active={filters.genres.includes(genre.name)}
                    onClick={() => patch({ genres: toggleInList(filters.genres, genre.name) })}
                  >
                    {genre.name} · {genre.count}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active
          ? "border-steam bg-steam-dim/30 text-steam"
          : "border-line bg-ink text-muted hover:border-steam-dim hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

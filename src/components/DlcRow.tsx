"use client";

import { formatMoney } from "@/lib/money";
import type { DlcRow as Row } from "@/lib/client/filters";
import SteamImage from "./SteamImage";
import { Badge } from "./ui";

const storeUrl = (appid: number) => `https://store.steampowered.com/app/${appid}/`;

export default function DlcRowItem({
  row,
  selected,
  onToggle,
  onMarkBought,
  onPickGame,
}: {
  row: Row;
  selected: boolean;
  onToggle: () => void;
  onMarkBought: () => void;
  onPickGame: () => void;
}) {
  const { item } = row;
  const price = item.free
    ? "Бесплатно"
    : (item.formatted ?? formatMoney(item.final, item.currency));

  return (
    <div
      className={`group flex items-center gap-3 border-b border-line/40 px-3 py-2.5 transition-colors last:border-b-0 ${
        selected ? "bg-steam-dim/15" : "hover:bg-raised/50"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        disabled={row.owned}
        className="h-4 w-4 shrink-0 cursor-pointer accent-steam disabled:opacity-30"
        title={row.owned ? "Уже куплено" : "Выбрать"}
      />

      <a
        href={storeUrl(item.id)}
        target="_blank"
        rel="noreferrer"
        className="hidden shrink-0 overflow-hidden rounded-md ring-1 ring-line/60 transition-shadow group-hover:ring-steam-dim sm:block"
      >
        <SteamImage appid={item.id} alt="" className="h-[44px] w-[116px]" />
      </a>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <a
            href={storeUrl(item.id)}
            target="_blank"
            rel="noreferrer"
            className="truncate text-[15px] font-medium text-slate-100 transition-colors hover:text-steam"
          >
            {item.name}
          </a>
          {row.owned ? <Badge>куплено</Badge> : null}
          {row.wishlisted ? <Badge tone="info">вишлист</Badge> : null}
          {row.lowestEver && item.discount > 0 ? <Badge tone="sale">минимум</Badge> : null}
          {item.coming ? <Badge tone="warn">скоро</Badge> : null}
          {item.unavailable ? <Badge tone="warn">нет в регионе</Badge> : null}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          <button
            type="button"
            onClick={onPickGame}
            className="max-w-full truncate transition-colors hover:text-steam"
            title="Показать только дополнения этой игры"
          >
            {row.gameName}
          </button>
          {row.playtimeHours > 0 ? <span>· {row.playtimeHours} ч наиграно</span> : null}
          {row.history?.min != null && !row.lowestEver ? (
            <span title={`Минимум зафиксирован ${row.history.minDate}`}>
              · минимум был {formatMoney(row.history.min, item.currency)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 text-right">
        {item.discount > 0 && !item.free ? (
          <div className="flex items-center justify-end gap-2">
            <span className="rounded-md bg-sale-bg px-1.5 py-1 text-xs font-bold text-sale">
              −{item.discount}%
            </span>
            <div>
              <div className="text-[11px] text-muted line-through">
                {formatMoney(item.initial, item.currency)}
              </div>
              <div className="text-sm font-semibold text-sale">{price}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm font-medium text-slate-200">{price}</div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <a
          href={`steam://openurl/${storeUrl(item.id)}`}
          title="Открыть в клиенте Steam"
          className="rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-raised hover:text-steam"
        >
          Steam
        </a>
        {!row.owned ? (
          <button
            type="button"
            onClick={onMarkBought}
            title="Отметить как купленное"
            className="rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-raised hover:text-sale"
          >
            ✓
          </button>
        ) : null}
      </div>
    </div>
  );
}

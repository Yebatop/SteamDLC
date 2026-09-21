"use client";

import { formatMoney } from "@/lib/money";
import type { DlcRow as Row } from "@/lib/client/filters";
import SteamImage from "./SteamImage";
import { Badge } from "./ui";

const storeUrl = (appid: number) => `https://store.steampowered.com/app/${appid}/`;

/** Плиточный вид каталога: крупная обложка, цена и один клик до магазина. */
export default function DlcCard({
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
      className={`lift group relative flex flex-col overflow-hidden rounded-xl border bg-panel ${
        selected ? "border-steam" : "border-line"
      }`}
    >
      <a href={storeUrl(item.id)} target="_blank" rel="noreferrer" className="relative block">
        <SteamImage appid={item.id} alt={item.name} className="h-[104px] w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-panel/90 via-transparent to-transparent" />
        {/* У бесплатного дополнения скидки быть не может — не показываем её. */}
        {item.discount > 0 && !item.free ? (
          <span className="absolute top-2 right-2 rounded-md bg-sale-bg px-1.5 py-1 text-xs font-bold text-sale shadow-lg">
            −{item.discount}%
          </span>
        ) : null}
      </a>

      <label
        // На телефоне наведения нет, поэтому галочка видна всегда.
        className={`absolute top-2 left-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md ring-1 backdrop-blur transition-colors ${
          selected
            ? "bg-steam text-ink ring-steam"
            : "bg-ink/70 text-muted/60 ring-line hover:text-slate-100"
        } ${row.owned ? "hidden" : ""}`}
        title="Выбрать"
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="sr-only"
          disabled={row.owned}
        />
        <span className="text-sm font-bold">✓</span>
      </label>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <a
          href={storeUrl(item.id)}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 text-sm leading-snug font-medium text-slate-100 transition-colors hover:text-steam"
        >
          {item.name}
        </a>

        <button
          type="button"
          onClick={onPickGame}
          className="truncate text-left text-xs text-muted transition-colors hover:text-steam"
          title="Показать только дополнения этой игры"
        >
          {row.gameName}
          {row.playtimeHours > 0 ? ` · ${row.playtimeHours} ч` : ""}
        </button>

        <div className="flex flex-wrap gap-1">
          {row.owned ? <Badge>куплено</Badge> : null}
          {row.wishlisted ? <Badge tone="info">вишлист</Badge> : null}
          {row.lowestEver && item.discount > 0 ? <Badge tone="sale">минимум</Badge> : null}
          {item.coming ? <Badge tone="warn">скоро</Badge> : null}
          {item.unavailable ? <Badge tone="warn">нет в регионе</Badge> : null}
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            {item.discount > 0 && !item.free ? (
              <div className="text-[11px] text-muted line-through">
                {formatMoney(item.initial, item.currency)}
              </div>
            ) : null}
            <div
              className={`text-sm font-semibold ${
                item.discount > 0 && !item.free ? "text-sale" : "text-slate-200"
              }`}
            >
              {price}
            </div>
          </div>

          {!row.owned ? (
            <button
              type="button"
              onClick={onMarkBought}
              title="Отметить как купленное"
              className="rounded-md px-2 py-1 text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-raised hover:text-sale"
            >
              ✓ куплено
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

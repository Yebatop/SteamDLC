"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";
import type { DlcRow } from "@/lib/client/filters";
import { Button, Modal } from "./ui";

const storeUrl = (appid: number) => `https://store.steampowered.com/app/${appid}/`;

/**
 * «Очередь покупок». Steam не даёт добавить товар в корзину по ссылке — корзина
 * живёт в сессии магазина. Поэтому самое быстрое, что возможно без расширения
 * браузера: открывать страницы выбранных DLC по одной и отмечать купленное.
 */
export default function BuyQueue({
  rows,
  onMarkBought,
  onClose,
}: {
  rows: DlcRow[];
  onMarkBought: (appid: number) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + (row.item.final ?? 0), 0),
    [rows],
  );
  const currency = rows.find((row) => row.item.currency)?.item.currency ?? null;
  const current = rows[index] ?? null;

  const openCurrent = () => {
    if (!current) return;
    window.open(storeUrl(current.item.id), "_blank", "noopener,noreferrer");
  };

  const next = () => setIndex((value) => Math.min(value + 1, rows.length));

  const copyLinks = async () => {
    const text = rows.map((row) => `${row.item.name} — ${storeUrl(row.item.id)}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const openAll = () => {
    for (const row of rows.slice(0, 15)) {
      window.open(storeUrl(row.item.id), "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Modal title="Очередь покупок" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-line bg-ink px-3 py-2 text-sm">
          <span className="text-muted">
            Выбрано <b className="text-slate-100">{rows.length}</b> DLC
          </span>
          <span className="text-muted">
            Итого: <b className="text-sale">{formatMoney(total, currency)}</b>
          </span>
        </div>

        {current ? (
          <div className="space-y-3 rounded border border-line bg-raised/50 p-4">
            <div className="text-xs text-muted">
              {index + 1} из {rows.length}
            </div>
            <div className="text-lg font-semibold text-slate-100">{current.item.name}</div>
            <div className="text-sm text-muted">
              {current.gameName}
              {current.playtimeHours > 0 ? ` · ${current.playtimeHours} ч наиграно` : ""}
            </div>
            <div className="text-sm">
              {current.item.discount > 0 ? (
                <span className="font-semibold text-sale">
                  −{current.item.discount}% ·{" "}
                  {current.item.formatted ??
                    formatMoney(current.item.final, current.item.currency)}
                </span>
              ) : (
                <span className="text-slate-200">
                  {current.item.formatted ?? formatMoney(current.item.final, current.item.currency)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="primary" onClick={openCurrent}>
                Открыть страницу
              </Button>
              <a
                href={`steam://openurl/${storeUrl(current.item.id)}`}
                className="rounded border border-line bg-raised px-3 py-1.5 text-sm text-slate-200 hover:bg-line"
              >
                Открыть в клиенте
              </a>
              <Button
                onClick={() => {
                  onMarkBought(current.item.id);
                  next();
                }}
              >
                Куплено → дальше
              </Button>
              <Button variant="ghost" onClick={next}>
                Пропустить
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded border border-line bg-raised/50 p-6 text-center text-sm text-muted">
            Очередь пройдена. Купленное отмечено — его можно скрыть фильтром.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Button onClick={copyLinks}>{copied ? "Скопировано" : "Скопировать все ссылки"}</Button>
          <Button onClick={openAll} title="Браузер может заблокировать много вкладок сразу">
            Открыть первые 15 вкладок
          </Button>
          {index > 0 ? (
            <Button variant="ghost" onClick={() => setIndex(0)}>
              В начало
            </Button>
          ) : null}
        </div>

        <p className="text-xs leading-relaxed text-muted">
          Добавить сразу всё в корзину одной ссылкой Steam не позволяет — корзина привязана к
          сессии магазина. Поэтому очередь открывает страницы по одной: на каждой достаточно
          нажать «В корзину», а здесь отметить покупку.
        </p>
      </div>
    </Modal>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { DlcRow } from "@/lib/client/filters";
import type { Settings } from "@/lib/client/settings";
import { Button, Field, Modal, TextInput } from "./ui";

interface WatchResponse {
  watch: { minDiscount?: number; maxPrice?: number | null; telegramChatId?: string | null } | null;
  persistent?: boolean;
  error?: string;
}

/** Подписка на уведомления о скидках для выбранных DLC. */
export default function WatchDialog({
  rows,
  settings,
  token,
  onClose,
}: {
  rows: DlcRow[];
  settings: Settings;
  token: string;
  onClose: () => void;
}) {
  const [chatId, setChatId] = useState("");
  const [minDiscount, setMinDiscount] = useState(30);
  const [maxPrice, setMaxPrice] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/watch?token=${encodeURIComponent(token)}`)
      .then((response) => response.json() as Promise<WatchResponse>)
      .then((data) => {
        if (cancelled || !data.watch) return;
        setExisting(true);
        setChatId(data.watch.telegramChatId ?? "");
        setMinDiscount(data.watch.minDiscount ?? 30);
        setMaxPrice(data.watch.maxPrice ? String(data.watch.maxPrice / 100) : "");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token]);

  const save = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          cc: settings.cc,
          lang: settings.lang,
          telegramChatId: chatId.trim() || null,
          minDiscount,
          maxPrice: maxPrice.trim() === "" ? null : Math.round(Number(maxPrice) * 100),
          items: rows.map((row) => ({
            id: row.item.id,
            name: row.item.name,
            parentName: row.gameName,
          })),
        }),
      });
      const data = (await response.json()) as WatchResponse;
      if (!response.ok) throw new Error(data.error ?? "Не удалось сохранить");
      setExisting(true);
      setStatus(`Отслеживаю ${rows.length} DLC. Проверка раз в сутки.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await fetch(`/api/watch?token=${encodeURIComponent(token)}`, { method: "DELETE" });
      setExisting(false);
      setStatus("Отслеживание отключено");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Уведомления о скидках" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">
          Раз в сутки сервер проверит цены выбранных DLC и пришлёт сообщение, когда условие
          выполнится. Повторно об одной и той же цене не напомнит.
        </p>

        <div className="rounded border border-line bg-ink px-3 py-2 text-sm">
          Под наблюдением: <b className="text-slate-100">{rows.length}</b> DLC
          {rows.length === 0 ? (
            <span className="text-warn"> — сначала выбери DLC галочками в списке</span>
          ) : null}
        </div>

        <Field
          label="Telegram chat ID"
          hint={
            <>
              Напиши своему боту любое сообщение, затем узнай chat ID у{" "}
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noreferrer"
                className="text-steam underline"
              >
                @userinfobot
              </a>
              . На сервере должен быть задан TELEGRAM_BOT_TOKEN.
            </>
          }
        >
          <TextInput value={chatId} onChange={setChatId} placeholder="123456789" mono />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-slate-300">
              Скидка от: <b className="text-steam">{minDiscount}%</b>
            </span>
            <input
              type="range"
              min={0}
              max={95}
              step={5}
              value={minDiscount}
              onChange={(event) => setMinDiscount(Number(event.target.value))}
              className="w-full"
            />
          </label>

          <Field label="Или цена не выше">
            <TextInput value={maxPrice} onChange={setMaxPrice} placeholder="например, 200" />
          </Field>
        </div>

        {status ? <div className="text-sm text-sale">{status}</div> : null}
        {error ? <div className="text-sm text-danger">{error}</div> : null}

        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <Button variant="primary" onClick={save} disabled={busy || rows.length === 0}>
            {busy ? "Сохраняю…" : "Сохранить"}
          </Button>
          {existing ? (
            <Button variant="danger" onClick={remove} disabled={busy}>
              Отключить
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

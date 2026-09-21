"use client";

import { useState } from "react";
import { Button } from "./ui";

interface Check {
  name: string;
  host: string;
  ok: boolean;
  status: number;
  ms: number;
  detail: string;
}

interface DiagResult {
  checks: Check[];
  env: { steamApiKey: boolean; storage: boolean; telegram: boolean };
}

interface KeyResult {
  ok: boolean;
  status: number;
  message: string;
}

/**
 * Показывает, что видит сервер, когда идёт в Steam: доступность обоих сервисов
 * и принят ли ключ. Без этого «не работает» на хостинге неотличимо от
 * «неверный ключ» — а логи Vercel с телефона не откроешь.
 */
export default function Diagnostics({ apiKey }: { apiKey: string }) {
  const [busy, setBusy] = useState(false);
  const [diag, setDiag] = useState<DiagResult | null>(null);
  const [key, setKey] = useState<KeyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const [diagResponse, keyResponse] = await Promise.all([
        fetch("/api/diag").then((response) => response.json() as Promise<DiagResult>),
        fetch("/api/diag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey }),
        }).then((response) => response.json() as Promise<{ key: KeyResult }>),
      ]);
      setDiag(diagResponse);
      setKey(keyResponse.key);
    } catch {
      setError("Не удалось выполнить проверку — сервер приложения не ответил");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button onClick={run} disabled={busy}>
        {busy ? "Проверяю…" : "Проверить доступ к Steam"}
      </Button>

      {error ? <div className="text-sm text-danger">{error}</div> : null}

      {diag ? (
        <div className="space-y-2 rounded border border-line bg-ink/60 p-3 text-xs">
          {diag.checks.map((check) => (
            <Line
              key={check.name}
              ok={check.ok}
              title={`${check.name} — ${check.ok ? "доступно" : `ошибка ${check.status || "нет ответа"}`}`}
              detail={check.detail || `${check.host} · ${check.ms} мс`}
            />
          ))}

          {key ? (
            <Line ok={key.ok} title={key.message} detail={`${key.status || "нет ответа"}`} />
          ) : null}

          <div className="border-t border-line/60 pt-2 text-muted">
            На сервере задано: ключ — {diag.env.steamApiKey ? "да" : "нет"}, хранилище истории —{" "}
            {diag.env.storage ? "да" : "нет"}, Telegram — {diag.env.telegram ? "да" : "нет"}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Line({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return (
    <div className="flex gap-2">
      <span className={ok ? "text-sale" : "text-danger"}>{ok ? "✓" : "✗"}</span>
      <div className="min-w-0">
        <div className="text-slate-200">{title}</div>
        {detail ? <div className="break-words text-muted">{detail}</div> : null}
      </div>
    </div>
  );
}

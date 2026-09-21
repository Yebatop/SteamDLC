"use client";

import { useEffect, useState } from "react";
import { plural } from "@/lib/plural";
import { discoveredDlcCount, syncProgress, type SyncState } from "@/lib/client/sync";
import { Button } from "./ui";

/** Обратный отсчёт до конца паузы. Тикает локально, состояние не трогает. */
function Countdown({ until }: { until: number }) {
  const [left, setLeft] = useState(() => Math.max(0, until - Date.now()));

  useEffect(() => {
    const timer = setInterval(() => setLeft(Math.max(0, until - Date.now())), 1000);
    return () => clearInterval(timer);
  }, [until]);

  const seconds = Math.ceil(left / 1000);
  return (
    <span className="text-warn">
      Steam ограничил частоту запросов — лимит считается на весь хостинг, а не на тебя.
      Продолжу автоматически через {seconds} {plural(seconds, "секунду", "секунды", "секунд")}.
    </span>
  );
}

export default function SyncBar({
  state,
  running,
  onStart,
  onPause,
}: {
  state: SyncState;
  running: boolean;
  onStart: () => void;
  onPause: () => void;
}) {
  const active = running && state.stage !== "done" && state.stage !== "error";
  const waiting = active && state.waitUntil > Date.now();
  const { done, total, label } = syncProgress(state);
  const found = discoveredDlcCount(state);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  if (!active && state.stage === "done" && !state.error) return null;

  return (
    <div className="space-y-2 rounded-lg border border-line bg-panel p-4">
      {waiting ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Countdown until={state.waitUntil} />
          <Button variant="ghost" onClick={onPause}>
            Приостановить
          </Button>
        </div>
      ) : null}

      {active && !waiting ? (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-200">
              {label}: {done} из {total}
            </span>
            <Button variant="ghost" onClick={onPause}>
              Приостановить
            </Button>
          </div>
          <div className="h-2 overflow-hidden rounded bg-ink">
            <div
              className="h-full bg-steam transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            {found > 0 ? `Найдено дополнений: ${found}. ` : ""}
            Можно закрыть вкладку — прогресс сохраняется и продолжится с этого места.
          </p>
        </>
      ) : null}

      {!active && state.error ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-warn">{state.error}</span>
          <Button variant="primary" onClick={onStart}>
            Продолжить
          </Button>
        </div>
      ) : null}

      {!active && !state.error && state.stage === "paused" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted">Синхронизация приостановлена</span>
          <Button variant="primary" onClick={onStart}>
            Продолжить
          </Button>
        </div>
      ) : null}
    </div>
  );
}

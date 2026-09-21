"use client";

import { syncProgress, type SyncState } from "@/lib/client/sync";
import { Button } from "./ui";

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
  const { done, total, label } = syncProgress(state);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  if (!active && state.stage === "done" && !state.error) return null;

  return (
    <div className="space-y-2 rounded-lg border border-line bg-panel p-4">
      {active ? (
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

"use client";

import { REGIONS } from "@/lib/regions";
import type { Ownership } from "@/lib/client/ownership";
import type { Settings } from "@/lib/client/settings";
import Diagnostics from "./Diagnostics";
import UserdataImport from "./UserdataImport";
import { Button, Field, TextInput } from "./ui";

export default function Onboarding({
  settings,
  onChange,
  ownership,
  onImport,
  onStart,
  busy,
  error,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  ownership: Ownership;
  onImport: (ownership: Ownership) => void;
  onStart: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">
          Все DLC твоей библиотеки — одним списком
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Steam показывает дополнения по одной игре за раз. Здесь они собираются вместе: видно,
          что не куплено, что со скидкой и что относится к играм, в которые ты реально играешь.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-5 rounded-lg border border-line bg-panel p-5">
          <div className="text-xs font-semibold tracking-wide text-steam uppercase">
            Шаг 1 — доступ к библиотеке
          </div>

          <Field
            label="Профиль Steam"
            hint="SteamID64 (17 цифр) или ссылка вида steamcommunity.com/id/nickname"
          >
            <TextInput
              value={settings.profile}
              onChange={(profile) => onChange({ ...settings, profile })}
              placeholder="76561198000000000"
            />
          </Field>

          <Field
            label="Ключ Steam Web API"
            hint={
              <>
                Получить можно за минуту на{" "}
                <a
                  href="https://steamcommunity.com/dev/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-steam underline"
                >
                  steamcommunity.com/dev/apikey
                </a>
                . Ключ хранится только в этом браузере. Если ключ задан в переменных окружения
                проекта, поле можно оставить пустым.
              </>
            }
          >
            <TextInput
              value={settings.apiKey}
              onChange={(apiKey) => onChange({ ...settings, apiKey })}
              placeholder="необязательно, если задан на сервере"
              type="password"
              mono
            />
          </Field>

          <Field
            label="Регион цен"
            hint="Выбирай регион своего аккаунта: в чужом регионе цена показывается, но купить по ней нельзя."
          >
            <select
              value={settings.cc}
              onChange={(event) => {
                const region = REGIONS.find((item) => item.cc === event.target.value);
                if (region) onChange({ ...settings, cc: region.cc, lang: region.lang });
              }}
              className="w-full rounded border border-line bg-ink px-3 py-2 text-sm text-slate-100 outline-none focus:border-steam"
            >
              {REGIONS.map((region) => (
                <option key={region.cc} value={region.cc}>
                  {region.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="rounded border border-line/60 bg-ink/60 p-3 text-xs leading-relaxed text-muted">
            Профиль должен быть открыт: Steam → Настройки приватности → «Игровые данные» →
            «Для всех». Иначе список игр не отдаётся.
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Button
                onClick={onStart}
                variant="primary"
                disabled={busy || !settings.profile.trim()}
              >
                {busy ? "Загружаю…" : "Загрузить библиотеку"}
              </Button>
              {error ? <span className="text-sm text-danger">{error}</span> : null}
            </div>

            {/* Если загрузка не удалась, первым делом нужно понять, что видит сервер. */}
            <Diagnostics apiKey={settings.apiKey} />
          </div>
        </section>

        <section className="space-y-5 rounded-lg border border-line bg-panel p-5">
          <div className="text-xs font-semibold tracking-wide text-steam uppercase">
            Шаг 2 — что у тебя уже есть (необязательно)
          </div>
          <UserdataImport ownership={ownership} onImport={onImport} />
          <div className="rounded border border-line/60 bg-ink/60 p-3 text-xs leading-relaxed text-muted">
            Можно пропустить и сделать позже — тогда список покажет все DLC подряд, а купленные
            ты сможешь отмечать вручную.
          </div>
        </section>
      </div>
    </div>
  );
}

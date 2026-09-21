"use client";

import { REGIONS } from "@/lib/regions";
import type { Ownership } from "@/lib/client/ownership";
import type { Settings } from "@/lib/client/settings";
import Diagnostics from "./Diagnostics";
import UserdataImport from "./UserdataImport";
import { Button, Field, Select, TextInput } from "./ui";

const FEATURES = [
  {
    title: "Все дополнения разом",
    text: "Каталог DLC ко всем играм библиотеки вместо хождения по сотням страниц магазина.",
  },
  {
    title: "Сначала то, что нужно",
    text: "Скидка, взвешенная по наигранным часам: дополнения к любимым играм — наверху.",
  },
  {
    title: "Цена под контролем",
    text: "История цен, отметка исторического минимума и уведомления о скидках в Telegram.",
  },
];

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
    <div className="hero-glow">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <header className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-panel/60 px-3 py-1 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-sale" />
            Работает с библиотекой любого размера
          </div>

          <h1 className="gradient-text text-4xl leading-tight font-bold sm:text-5xl">
            Все DLC твоей библиотеки
            <br />
            одним списком
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
            Steam показывает дополнения по одной игре за раз. Здесь они собираются вместе:
            видно, что не куплено, что со скидкой и что относится к играм, в которые ты
            действительно играешь.
          </p>
        </header>

        <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-line bg-panel/70 p-4 text-left"
            >
              <div className="text-sm font-semibold text-slate-100">{feature.title}</div>
              <div className="mt-1 text-xs leading-relaxed text-muted">{feature.text}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <section className="space-y-5 rounded-2xl border border-line bg-panel p-6 shadow-xl shadow-black/30">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold tracking-widest text-steam uppercase">
                Шаг 1
              </span>
              <span className="text-sm text-muted">доступ к библиотеке</span>
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
                    className="text-steam underline underline-offset-2"
                  >
                    steamcommunity.com/dev/apikey
                  </a>
                  . Хранится только в этом браузере.
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
              hint="Выбирай регион своего аккаунта: в чужом цена показывается, но купить по ней нельзя."
            >
              <Select
                value={settings.cc}
                onChange={(cc) => {
                  const region = REGIONS.find((item) => item.cc === cc);
                  if (region) onChange({ ...settings, cc: region.cc, lang: region.lang });
                }}
              >
                {REGIONS.map((region) => (
                  <option key={region.cc} value={region.cc}>
                    {region.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="rounded-lg border border-line/70 bg-ink/50 p-3 text-xs leading-relaxed text-muted">
              Профиль должен быть открыт: Steam → Настройки приватности → «Игровые данные» →
              «Для всех». Иначе список игр не отдаётся.
            </div>

            <div className="space-y-3">
              <Button
                onClick={onStart}
                variant="primary"
                size="lg"
                disabled={busy || !settings.profile.trim()}
                className="w-full"
              >
                {busy ? "Загружаю…" : "Собрать каталог"}
              </Button>
              {error ? (
                <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                  {error}
                </div>
              ) : null}
              <Diagnostics apiKey={settings.apiKey} />
            </div>
          </section>

          <section className="space-y-5 rounded-2xl border border-line bg-panel p-6 shadow-xl shadow-black/30">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-bold tracking-widest text-steam uppercase">
                Шаг 2
              </span>
              <span className="text-sm text-muted">что у тебя уже есть — по желанию</span>
            </div>
            <UserdataImport ownership={ownership} onImport={onImport} />
          </section>
        </div>

        <p className="mt-10 text-center text-xs text-muted">
          Данные хранятся в твоём браузере. Ни аккаунтов, ни паролей Steam, ни серверной базы
          с твоей библиотекой.
        </p>
      </div>
    </div>
  );
}

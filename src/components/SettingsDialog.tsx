"use client";

import { REGIONS } from "@/lib/regions";
import type { Ownership } from "@/lib/client/ownership";
import type { Settings } from "@/lib/client/settings";
import Diagnostics from "./Diagnostics";
import UserdataImport from "./UserdataImport";
import { Button, Field, Modal, TextInput } from "./ui";

export default function SettingsDialog({
  settings,
  onChange,
  ownership,
  onImport,
  onResync,
  onReset,
  onClose,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  ownership: Ownership;
  onImport: (ownership: Ownership) => void;
  onResync: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Настройки" onClose={onClose} wide>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Профиль Steam">
            <TextInput
              value={settings.profile}
              onChange={(profile) => onChange({ ...settings, profile })}
            />
          </Field>

          <Field label="Ключ Steam Web API" hint="Хранится только в этом браузере">
            <TextInput
              value={settings.apiKey}
              onChange={(apiKey) => onChange({ ...settings, apiKey })}
              type="password"
              mono
            />
          </Field>
        </div>

        <Field
          label="Регион цен"
          hint="После смены региона нужно обновить данные — цены кэшируются вместе с валютой."
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

        <div className="border-t border-line pt-4">
          <UserdataImport ownership={ownership} onImport={onImport} compact />
        </div>

        <div className="border-t border-line pt-4">
          <Diagnostics apiKey={settings.apiKey} />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button variant="primary" onClick={onResync}>
            Обновить данные
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm("Удалить все локальные данные: библиотеку, цены, отметки?")) {
                onReset();
              }
            }}
          >
            Стереть всё локально
          </Button>
        </div>
      </div>
    </Modal>
  );
}

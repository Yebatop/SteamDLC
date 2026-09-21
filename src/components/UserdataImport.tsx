"use client";

import { useState } from "react";
import { OwnershipParseError, parseUserdata, type Ownership } from "@/lib/client/ownership";
import { Button, Field } from "./ui";

const USERDATA_URL = "https://store.steampowered.com/dynamicstore/userdata/";

/**
 * Импорт списка купленного. Steam Web API не отдаёт DLC, поэтому единственный
 * рабочий способ — забрать JSON из залогиненного браузера самого пользователя.
 * Данные разбираются здесь же, на клиенте, и на сервер не отправляются.
 */
export default function UserdataImport({
  ownership,
  onImport,
  compact,
}: {
  ownership: Ownership;
  onImport: (ownership: Ownership) => void;
  compact?: boolean;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const imported = ownership.importedAt > 0;

  const handleImport = () => {
    try {
      onImport(parseUserdata(text));
      setText("");
      setError(null);
    } catch (parseError) {
      setError(
        parseError instanceof OwnershipParseError
          ? parseError.message
          : "Не удалось разобрать JSON",
      );
    }
  };

  return (
    <div className="space-y-3">
      <Field
        label="Что уже куплено"
        hint={
          <>
            Открой{" "}
            <a
              href={USERDATA_URL}
              target="_blank"
              rel="noreferrer"
              className="text-steam underline"
            >
              store.steampowered.com/dynamicstore/userdata/
            </a>{" "}
            в браузере, где ты залогинен в Steam, выдели всё (Ctrl+A), скопируй и вставь сюда.
            Пароль и логин не нужны, данные никуда не отправляются — разбор происходит прямо
            в этой вкладке.
          </>
        }
      >
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder='{"rgOwnedApps":[...], "rgWishlist":[...]}'
          rows={compact ? 3 : 5}
          className="w-full rounded border border-line bg-ink px-3 py-2 font-mono text-xs text-slate-100 outline-none placeholder:text-muted/50 focus:border-steam"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleImport} disabled={text.trim().length === 0} variant="primary">
          Импортировать
        </Button>
        {imported ? (
          <span className="text-xs text-muted">
            Загружено: {ownership.owned.length} позиций, вишлист — {ownership.wishlist.length}
          </span>
        ) : (
          <span className="text-xs text-warn">
            Без импорта купленные DLC не отличить от некупленных
          </span>
        )}
      </div>

      {error ? <div className="text-sm text-danger">{error}</div> : null}
    </div>
  );
}

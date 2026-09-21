"use client";

import { useState } from "react";
import { OwnershipParseError, parseUserdata, type Ownership } from "@/lib/client/ownership";
import { plural } from "@/lib/plural";
import { Button } from "./ui";

const USERDATA_URL = "https://store.steampowered.com/dynamicstore/userdata/";

/**
 * Импорт списка купленного. Steam Web API не отдаёт DLC, поэтому единственный
 * рабочий способ — забрать JSON из залогиненного браузера самого пользователя.
 * Данные разбираются здесь же, на клиенте, и на сервер не отправляются.
 *
 * Весь смысл этого экрана — чтобы шагов было как можно меньше: открыть,
 * скопировать, вставить из буфера одной кнопкой.
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
  const [manual, setManual] = useState(false);

  const imported = ownership.importedAt > 0;

  const apply = (raw: string) => {
    try {
      onImport(parseUserdata(raw));
      setText("");
      setError(null);
    } catch (parseError) {
      setError(
        parseError instanceof OwnershipParseError
          ? parseError.message
          : "Не удалось разобрать данные",
      );
    }
  };

  const pasteFromClipboard = async () => {
    setError(null);
    try {
      const clipboard = await navigator.clipboard.readText();
      if (!clipboard.trim()) {
        setError("Буфер обмена пуст — сначала скопируй страницу Steam");
        return;
      }
      apply(clipboard);
    } catch {
      setError(
        "Браузер не дал доступ к буферу. Нажми «Вставить вручную» и вставь текст в поле.",
      );
      setManual(true);
    }
  };

  return (
    <div className="space-y-4">
      {imported ? (
        <div className="flex items-start gap-3 rounded-lg border border-sale/30 bg-sale/10 p-3">
          <span className="text-lg leading-none text-sale">✓</span>
          <div className="text-sm">
            <div className="font-medium text-slate-100">Список купленного загружен</div>
            <div className="text-muted">
              {ownership.owned.length}{" "}
              {plural(ownership.owned.length, "позиция", "позиции", "позиций")} в библиотеке,{" "}
              {ownership.wishlist.length} в вишлисте
            </div>
          </div>
        </div>
      ) : null}

      <ol className="space-y-3">
        <Step number={1} title="Открой страницу Steam">
          <a
            href={USERDATA_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-raised px-3 py-2 text-sm font-medium text-steam ring-1 ring-line transition-colors hover:bg-line"
          >
            Открыть в новой вкладке ↗
          </a>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Нужно быть залогиненным в Steam в этом же браузере. Пароль нигде не вводится.
          </p>
        </Step>

        <Step number={2} title="Скопируй всё">
          <p className="text-xs leading-relaxed text-muted">
            На телефоне: долгое нажатие на текст → «Выделить всё» → «Копировать».
            <br />
            На компьютере: Ctrl+A, затем Ctrl+C.
          </p>
        </Step>

        <Step number={3} title="Вернись сюда и вставь">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={pasteFromClipboard}>
              Вставить из буфера
            </Button>
            <Button variant="ghost" onClick={() => setManual((value) => !value)}>
              {manual ? "Скрыть поле" : "Вставить вручную"}
            </Button>
          </div>
        </Step>
      </ol>

      {manual ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder='{"rgOwnedApps":[...], "rgWishlist":[...]}'
            rows={compact ? 3 : 4}
            className="w-full rounded-lg border border-line bg-ink px-3 py-2 font-mono text-xs text-slate-100 outline-none transition-colors placeholder:text-muted/50 focus:border-steam"
          />
          <Button onClick={() => apply(text)} disabled={text.trim().length === 0}>
            Импортировать
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {!imported ? (
        <p className="text-xs leading-relaxed text-muted">
          Без этого шага каталог покажет все дополнения подряд — купленные не будут отличаться
          от остальных. Можно пропустить и отмечать покупки вручную.
        </p>
      ) : null}
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-steam-dim/25 text-xs font-bold text-steam">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-200">{title}</div>
        <div className="mt-1">{children}</div>
      </div>
    </li>
  );
}

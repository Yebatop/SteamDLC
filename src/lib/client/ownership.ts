export interface Ownership {
  /** appid всего, чем владеет аккаунт, включая DLC. */
  owned: number[];
  wishlist: number[];
  /** «Скрытые» в магазине. */
  ignored: number[];
  importedAt: number;
}

export const EMPTY_OWNERSHIP: Ownership = {
  owned: [],
  wishlist: [],
  ignored: [],
  importedAt: 0,
};

function numbers(value: unknown): number[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  }
  // rgIgnoredApps приходит объектом: { "12345": 0 }
  if (value && typeof value === "object") {
    return [...new Set(Object.keys(value).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  }
  return [];
}

export class OwnershipParseError extends Error {}

/**
 * Разбирает JSON со страницы store.steampowered.com/dynamicstore/userdata/
 *
 * Это единственный способ узнать, какие DLC уже куплены: Web API их не отдаёт
 * (GetOwnedGames возвращает только игры). Данные забираются самим пользователем
 * в его залогиненном браузере и никуда не уходят — парсинг целиком на клиенте.
 */
export function parseUserdata(text: string): Ownership {
  const trimmed = text.trim();
  if (!trimmed) throw new OwnershipParseError("Пусто: вставь JSON со страницы userdata");

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new OwnershipParseError(
      "Это не JSON. Открой store.steampowered.com/dynamicstore/userdata/ и скопируй страницу целиком.",
    );
  }

  const data = parsed as Record<string, unknown>;
  if (!("rgOwnedApps" in data)) {
    throw new OwnershipParseError(
      "В JSON нет поля rgOwnedApps. Похоже, ты был разлогинен — зайди в Steam в браузере и обнови страницу userdata.",
    );
  }

  const owned = numbers(data.rgOwnedApps);
  if (owned.length === 0) {
    throw new OwnershipParseError(
      "Список купленного пуст. Обычно это значит, что страница открыта без авторизации в Steam.",
    );
  }

  return {
    owned,
    wishlist: numbers(data.rgWishlist),
    ignored: numbers(data.rgIgnoredApps),
    importedAt: Date.now(),
  };
}

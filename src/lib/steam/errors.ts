/**
 * Ошибки обращения к Steam и их перевод в понятный пользователю текст.
 *
 * Модуль намеренно не импортирует ничего во время выполнения: так его логику
 * можно прогнать юнит-тестами без сети и без сборщика.
 */

export type SteamErrorCode =
  | "no_key"
  | "bad_api_key"
  | "bad_steamid"
  | "private_profile"
  | "vanity_not_found"
  | "rate_limited"
  | "store_forbidden"
  | "offline"
  | "upstream";

export const STEAM_WEB_API_HOST = "api.steampowered.com";
export const STEAM_STORE_HOST = "store.steampowered.com";

/**
 * Транспортная ошибка: Steam ответил не тем статусом или не ответил вовсе.
 *
 * Поля объявлены явно, а не через параметры конструктора: сокращённая запись
 * не поддерживается режимом strip-only, на котором эти классы гоняются тестами.
 */
export class SteamHttpError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  /** Хост, к которому шли: от него зависит, что означает 403. */
  readonly host: string;
  /** Очищенный кусок тела ответа — Steam часто пишет там причину. */
  readonly detail: string;

  constructor(message: string, status: number, retryable: boolean, host = "", detail = "") {
    super(message);
    this.name = "SteamHttpError";
    this.status = status;
    this.retryable = retryable;
    this.host = host;
    this.detail = detail;
  }
}

/** Логическая ошибка: Steam ответил корректно, но результат нас не устраивает. */
export class SteamApiError extends Error {
  readonly code: SteamErrorCode;

  constructor(message: string, code: SteamErrorCode) {
    super(message);
    this.name = "SteamApiError";
    this.code = code;
  }
}

export interface SteamErrorDescription {
  message: string;
  /** Статус, который вернём клиенту. */
  status: number;
  code: SteamErrorCode | "internal";
}

/** Вырезает разметку из тела ответа: Steam отдаёт причину внутри HTML. */
export function cleanDetail(raw: string, limit = 200): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

const isWebApi = (host: string) => host.includes(STEAM_WEB_API_HOST);
const isStore = (host: string) => host.includes(STEAM_STORE_HOST);

/**
 * Главное правило: не прятать разные причины за одним «Steam недоступен».
 * 403 от Web API почти всегда означает отклонённый ключ, а 403 от витрины —
 * что Steam не любит IP, с которого пришёл запрос. Это разные проблемы.
 */
export function describeSteamError(error: unknown): SteamErrorDescription {
  if (error instanceof SteamApiError) {
    const clientSide =
      error.code === "no_key" || error.code === "bad_steamid" || error.code === "bad_api_key";
    return { message: error.message, status: clientSide ? 400 : 502, code: error.code };
  }

  if (error instanceof SteamHttpError) {
    if (error.status === 429) {
      return {
        message:
          "Steam ограничил частоту запросов. Подожди минуту и нажми «Продолжить» — " +
          "уже загруженное не потеряется.",
        status: 429,
        code: "rate_limited",
      };
    }

    if ((error.status === 403 || error.status === 401) && isWebApi(error.host)) {
      return {
        message:
          "Steam отклонил ключ Web API (403). Чаще всего ключ скопирован не полностью, " +
          "отозван или принадлежит другому аккаунту. Проверь его на " +
          "steamcommunity.com/dev/apikey и вставь заново." +
          (error.detail ? ` Ответ Steam: ${error.detail}` : ""),
        status: 400,
        code: "bad_api_key",
      };
    }

    if (error.status === 403 && isStore(error.host)) {
      return {
        message:
          "Витрина Steam отклонила запрос с этого сервера (403). Так бывает, когда Steam " +
          "не пускает IP дата-центра. Помогает запуск на своём компьютере вместо хостинга.",
        status: 502,
        code: "store_forbidden",
      };
    }

    if (error.status === 0) {
      return {
        message:
          `Не удалось соединиться с ${error.host || "Steam"}. ` +
          "Похоже на блокировку сети или проблему у Steam — проверь /api/diag.",
        status: 502,
        code: "offline",
      };
    }

    return {
      message:
        `Steam ответил ${error.status}${error.host ? ` (${error.host})` : ""}.` +
        (error.detail ? ` ${error.detail}` : ""),
      status: 502,
      code: "upstream",
    };
  }

  return {
    message: error instanceof Error ? error.message : "Неизвестная ошибка",
    status: 500,
    code: "internal",
  };
}

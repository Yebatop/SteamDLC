import { NextResponse } from "next/server";
import { SteamApiError } from "./steam/api";
import { SteamHttpError } from "./steam/http";

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Превращает исключение в понятный пользователю ответ. */
export function failFromError(error: unknown) {
  if (error instanceof SteamApiError) {
    const status = error.code === "no_key" || error.code === "bad_steamid" ? 400 : 502;
    return fail(error.message, status, error.code);
  }
  if (error instanceof SteamHttpError) {
    if (error.status === 429) {
      return fail(
        "Steam временно ограничил частоту запросов. Подожди минуту и продолжи синхронизацию — " +
          "уже загруженное не потеряется.",
        429,
        "rate_limited",
      );
    }
    return fail(`Steam недоступен (${error.status || "нет ответа"})`, 502, "upstream");
  }
  const message = error instanceof Error ? error.message : "Неизвестная ошибка";
  return fail(message, 500, "internal");
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Тело запроса — не JSON");
  }
}

/** Достаёт список appid из тела запроса с ограничением размера. */
export function parseAppids(value: unknown, limit: number): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(
    0,
    limit,
  );
}

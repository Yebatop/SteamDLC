import { NextResponse } from "next/server";
import { describeSteamError } from "./steam/errors";

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Превращает исключение в понятный пользователю ответ. */
export function failFromError(error: unknown) {
  const described = describeSteamError(error);
  return fail(described.message, described.status, described.code);
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

import { NextResponse } from "next/server";
import { failFromError, readJson } from "@/lib/api-response";
import { safeCc, safeLang } from "@/lib/regions";
import { fetchDlcItems } from "@/lib/steam/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Функция на Vercel живёт не дольше maxDuration. Останавливаемся заранее и
 * отдаём то, что успели: клиент попросит остаток следующим запросом.
 */
const TIME_BUDGET_MS = 45_000;

const MAX_ITEMS = 40;

interface Body {
  /** appid DLC -> appid родительской игры */
  parents?: unknown;
  cc?: unknown;
  lang?: unknown;
  apiKey?: unknown;
}

/** Детали и цены пачки DLC. */
export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    const raw = body.parents;
    if (typeof raw !== "object" || raw === null) {
      return NextResponse.json({ items: [] });
    }

    const parents: Record<number, number> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const id = Number(key);
      const parent = Number(value);
      if (!Number.isInteger(id) || id <= 0) continue;
      if (Object.keys(parents).length >= MAX_ITEMS) break;
      parents[id] = Number.isInteger(parent) && parent > 0 ? parent : 0;
    }

    const apiKey =
      typeof body.apiKey === "string" && body.apiKey.trim()
        ? body.apiKey.trim()
        : process.env.STEAM_API_KEY;

    const { items, failed, processed, throttled } = await fetchDlcItems(parents, {
      cc: safeCc(body.cc),
      lang: safeLang(body.lang),
      deadline: Date.now() + TIME_BUDGET_MS,
      apiKey,
    });
    return NextResponse.json({ items, failed, processed, throttled });
  } catch (error) {
    return failFromError(error);
  }
}

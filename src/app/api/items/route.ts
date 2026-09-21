import { NextResponse } from "next/server";
import { failFromError, readJson } from "@/lib/api-response";
import { safeCc, safeLang } from "@/lib/regions";
import { fetchDlcItems } from "@/lib/steam/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ITEMS = 40;

interface Body {
  /** appid DLC -> appid родительской игры */
  parents?: unknown;
  cc?: unknown;
  lang?: unknown;
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

    const { items, failed } = await fetchDlcItems(parents, {
      cc: safeCc(body.cc),
      lang: safeLang(body.lang),
    });
    return NextResponse.json({ items, failed });
  } catch (error) {
    return failFromError(error);
  }
}

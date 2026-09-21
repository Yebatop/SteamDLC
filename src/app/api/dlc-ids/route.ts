import { NextResponse } from "next/server";
import { failFromError, parseAppids, readJson } from "@/lib/api-response";
import { safeCc, safeLang } from "@/lib/regions";
import { fetchDlcIds } from "@/lib/steam/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Функция на Vercel живёт не дольше maxDuration. Останавливаемся заранее и
 * отдаём то, что успели: клиент попросит остаток следующим запросом.
 */
const TIME_BUDGET_MS = 45_000;

/** Верхняя граница пачки: дальше решает бюджет времени. */
const MAX_APPS = 40;

interface Body {
  appids?: unknown;
  cc?: unknown;
  lang?: unknown;
}

/** Для пачки игр возвращает, у каких из них какие DLC. */
export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    const appids = parseAppids(body.appids, MAX_APPS);
    if (appids.length === 0) return NextResponse.json({ dlc: {} });

    const { dlc, failed, processed } = await fetchDlcIds(appids, {
      cc: safeCc(body.cc),
      lang: safeLang(body.lang),
      deadline: Date.now() + TIME_BUDGET_MS,
    });
    return NextResponse.json({ dlc, failed, processed });
  } catch (error) {
    return failFromError(error);
  }
}

import { NextResponse } from "next/server";
import { failFromError, parseAppids, readJson } from "@/lib/api-response";
import { safeCc, safeLang } from "@/lib/regions";
import { fetchDlcIds } from "@/lib/steam/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Больше 60 игр за раз не берём: упрёмся в таймаут функции. */
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

    const dlc = await fetchDlcIds(appids, { cc: safeCc(body.cc), lang: safeLang(body.lang) });
    return NextResponse.json({ dlc });
  } catch (error) {
    return failFromError(error);
  }
}

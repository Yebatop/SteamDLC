import { NextResponse } from "next/server";
import { failFromError, parseAppids, readJson } from "@/lib/api-response";
import { readHistories } from "@/lib/history";
import { kvIsPersistent } from "@/lib/kv";
import { safeCc } from "@/lib/regions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_APPS = 400;

interface Body {
  appids?: unknown;
  cc?: unknown;
}

/** История цен по списку DLC: минимум за всё время и точки для графика. */
export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    const appids = parseAppids(body.appids, MAX_APPS);
    const histories = await readHistories(safeCc(body.cc), appids);

    return NextResponse.json({
      histories,
      // Клиент должен понимать, почему история пустая.
      persistent: kvIsPersistent(),
    });
  } catch (error) {
    return failFromError(error);
  }
}

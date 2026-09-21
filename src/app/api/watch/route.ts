import { NextResponse } from "next/server";
import { fail, failFromError, readJson } from "@/lib/api-response";
import { rememberRegion, track } from "@/lib/history";
import { kvIsPersistent } from "@/lib/kv";
import {
  deleteWatch,
  isValidToken,
  readWatch,
  sanitizeWatch,
  writeWatch,
  type WatchConfig,
} from "@/lib/watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireStorage() {
  if (kvIsPersistent()) return null;
  return fail(
    "Уведомления и история цен требуют хранилища. Подключи Upstash Redis и задай " +
      "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN в переменных окружения проекта.",
    503,
    "no_storage",
  );
}

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!isValidToken(token)) return fail("Некорректный токен", 400);
    const config = await readWatch(token);
    return NextResponse.json({ watch: config, persistent: kvIsPersistent() });
  } catch (error) {
    return failFromError(error);
  }
}

/** Сохраняет подписку и ставит выбранные DLC на отслеживание цены. */
export async function POST(request: Request) {
  try {
    const blocked = requireStorage();
    if (blocked) return blocked;

    const body = await readJson<{ token?: string } & Partial<WatchConfig>>(request);
    const token = (body.token ?? "").trim();
    if (!isValidToken(token)) return fail("Некорректный токен", 400);

    const config = sanitizeWatch(token, body);
    if (config.items.length === 0) {
      await deleteWatch(token);
      return NextResponse.json({ watch: null });
    }

    await writeWatch(config);
    await rememberRegion(config.cc);
    await track(
      config.cc,
      config.items.map((item) => item.id),
    );

    return NextResponse.json({ watch: config });
  } catch (error) {
    return failFromError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (!isValidToken(token)) return fail("Некорректный токен", 400);
    await deleteWatch(token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failFromError(error);
  }
}

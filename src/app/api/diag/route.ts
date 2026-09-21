import { NextResponse } from "next/server";
import { cleanDetail, STEAM_STORE_HOST, STEAM_WEB_API_HOST } from "@/lib/steam/errors";
import { buildGetItemsInput, parseStoreItems } from "@/lib/steam/storeitem";
import { kvIsPersistent } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Самодиагностика: показывает, что именно видит сервер, когда идёт в Steam.
 *
 * Нужна потому, что «не работает» на хостинге может означать три разных вещи:
 * отклонённый ключ Web API, блокировку IP дата-центра витриной Steam или
 * лимит запросов. Логи Vercel с телефона не почитаешь — а эту страницу можно.
 */

const PROBE_TIMEOUT_MS = 10_000;
/** Публичный профиль Гейба: годится как подопытный для проверки ключа. */
const PROBE_STEAMID = "76561197960287930";

interface Probe {
  name: string;
  host: string;
  ok: boolean;
  status: number;
  ms: number;
  detail: string;
}

async function probe(name: string, url: string): Promise<Probe> {
  const host = new URL(url).host;
  const started = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SteamDLC/0.1 (+https://github.com/yebatop/steamdlc)",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    clearTimeout(timer);

    const body = await response.text().catch(() => "");
    return {
      name,
      host,
      ok: response.ok,
      status: response.status,
      ms: Date.now() - started,
      detail: response.ok ? "" : cleanDetail(body.slice(0, 500), 160),
    };
  } catch (error) {
    return {
      name,
      host,
      ok: false,
      status: 0,
      ms: Date.now() - started,
      detail: cleanDetail(error instanceof Error ? error.message : String(error), 160),
    };
  }
}

/** Доступность обоих сервисов Steam без всяких ключей. */
export async function GET() {
  const checks = await Promise.all([
    probe(
      "Web API (список игр)",
      `https://${STEAM_WEB_API_HOST}/ISteamWebAPIUtil/GetServerInfo/v1/`,
    ),
    probe(
      "Витрина (DLC и цены)",
      `https://${STEAM_STORE_HOST}/api/appdetails?appids=440&filters=basic&cc=us&l=english`,
    ),
  ]);

  // Отдельно: отвечает ли batch-сервис цен и понимаем ли мы его формат.
  const storeBrowse = await probeStoreBrowse();

  return NextResponse.json({
    checks: [...checks, storeBrowse],
    env: {
      // Сами значения не отдаём — только факт наличия.
      steamApiKey: Boolean(process.env.STEAM_API_KEY),
      storage: kvIsPersistent(),
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    },
  });
}

/** Пачка цен через api.steampowered.com — обход лимита витрины. */
async function probeStoreBrowse(): Promise<Probe> {
  const params = new URLSearchParams({ input_json: buildGetItemsInput([440], "us", "english") });
  const key = process.env.STEAM_API_KEY;
  if (key) params.set("key", key);

  const result = await probe(
    "Цены пачкой (в обход лимита витрины)",
    `https://${STEAM_WEB_API_HOST}/IStoreBrowseService/GetItems/v1/?${params.toString()}`,
  );
  if (!result.ok) return result;

  // Доступность мало что значит: важно, распознаём ли мы формат ответа.
  try {
    const response = await fetch(
      `https://${STEAM_WEB_API_HOST}/IStoreBrowseService/GetItems/v1/?${params.toString()}`,
      { cache: "no-store" },
    );
    const parsed = parseStoreItems(await response.json());
    return parsed && parsed.size > 0
      ? { ...result, detail: `формат распознан, позиций: ${parsed.size}` }
      : { ...result, ok: false, detail: "ответ есть, но формат незнакомый — уйдём на appdetails" };
  } catch {
    return { ...result, ok: false, detail: "ответ не разобрался" };
  }
}

interface KeyCheckBody {
  apiKey?: string;
}

/** Проверка конкретного ключа. POST, чтобы ключ не осел в логах и истории. */
export async function POST(request: Request) {
  let apiKey = "";
  try {
    const body = (await request.json()) as KeyCheckBody;
    apiKey = (body.apiKey || "").trim();
  } catch {
    // Пустое тело — проверим ключ из переменных окружения, если он есть.
  }

  const key = apiKey || process.env.STEAM_API_KEY || "";
  if (!key) {
    return NextResponse.json({
      key: { ok: false, status: 0, message: "Ключ не задан ни в интерфейсе, ни на сервере" },
    });
  }

  const params = new URLSearchParams({ key, steamids: PROBE_STEAMID });
  const result = await probe(
    "Ключ Web API",
    `https://${STEAM_WEB_API_HOST}/ISteamUser/GetPlayerSummaries/v2/?${params.toString()}`,
  );

  const message = result.ok
    ? "Ключ принят Steam"
    : result.status === 403 || result.status === 401
      ? "Steam отклонил ключ (403). Скопирован не полностью, отозван или от другого аккаунта."
      : result.status === 0
        ? `Сервер не смог соединиться с ${STEAM_WEB_API_HOST}: ${result.detail}`
        : `Steam ответил ${result.status}. ${result.detail}`;

  return NextResponse.json({
    key: { ok: result.ok, status: result.status, ms: result.ms, message },
  });
}

import { NextResponse } from "next/server";
import { fail, failFromError, readJson } from "@/lib/api-response";
import { fetchOwnedGames, resolveSteamId } from "@/lib/steam/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  profile?: string;
  apiKey?: string;
}

/**
 * POST, а не GET: ключ Steam Web API не должен попадать в URL,
 * логи доступа и историю браузера.
 */
export async function POST(request: Request) {
  try {
    const body = await readJson<Body>(request);
    const apiKey = (body.apiKey || process.env.STEAM_API_KEY || "").trim();
    const profile = (body.profile || "").trim();

    if (!profile) return fail("Укажи SteamID64 или ссылку на профиль", 400, "bad_steamid");
    if (!apiKey) {
      return fail(
        "Нужен ключ Steam Web API. Получи его на steamcommunity.com/dev/apikey и вставь в настройках.",
        400,
        "no_key",
      );
    }

    const steamId = await resolveSteamId(profile, apiKey);
    const games = await fetchOwnedGames(steamId, apiKey);

    return NextResponse.json({ steamId, games });
  } catch (error) {
    return failFromError(error);
  }
}

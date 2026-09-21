import { NextResponse } from "next/server";
import { failFromError } from "@/lib/api-response";
import { recordPrices, track, tracked, trackedRegions, type PriceSample } from "@/lib/history";
import { kvIsPersistent } from "@/lib/kv";
import { formatMoney } from "@/lib/money";
import { regionByCc } from "@/lib/regions";
import { fetchDlcItems } from "@/lib/steam/api";
import type { DlcItem } from "@/lib/steam/types";
import { allWatchTokens, readWatch, updateNotified } from "@/lib/watch";
import { escapeHtml, sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Сколько DLC успеваем опросить за один запуск, не упираясь в таймаут. */
const MAX_PER_REGION = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // Секрет не задан — считаем эндпоинт открытым (dev).
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Ежедневно: снимает цены отслеживаемых DLC и шлёт уведомления о скидках. */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  }
  if (!kvIsPersistent()) {
    return NextResponse.json({ skipped: "Хранилище не настроено" });
  }

  try {
    const regions = await trackedRegions();
    const pricesByRegion = new Map<string, Map<number, DlcItem>>();
    let sampled = 0;

    for (const cc of regions) {
      const appids = (await tracked(cc)).slice(0, MAX_PER_REGION);
      if (appids.length === 0) continue;

      const parents: Record<number, number> = {};
      for (const appid of appids) parents[appid] = 0;

      const items = await fetchDlcItems(parents, { cc, lang: regionByCc(cc).lang });
      const byId = new Map(items.map((item) => [item.id, item]));
      pricesByRegion.set(cc, byId);

      const samples: PriceSample[] = items
        .filter((item): item is DlcItem & { final: number } => typeof item.final === "number")
        .map((item) => ({ appid: item.id, final: item.final, discount: item.discount }));

      await recordPrices(cc, samples);
      sampled += samples.length;
    }

    const notifications = await notifySubscribers(pricesByRegion);
    return NextResponse.json({ regions: regions.length, sampled, notifications });
  } catch (error) {
    return failFromError(error);
  }
}

async function notifySubscribers(
  pricesByRegion: Map<string, Map<number, DlcItem>>,
): Promise<number> {
  const tokens = await allWatchTokens();
  let sent = 0;

  for (const token of tokens) {
    const config = await readWatch(token);
    if (!config || !config.telegramChatId || config.items.length === 0) continue;

    let prices = pricesByRegion.get(config.cc);
    if (!prices) {
      // Регион подписки ещё не опрашивался в этом запуске — добираем точечно.
      const parents: Record<number, number> = {};
      for (const item of config.items.slice(0, MAX_PER_REGION)) parents[item.id] = 0;
      const items = await fetchDlcItems(parents, {
        cc: config.cc,
        lang: regionByCc(config.cc).lang,
      });
      prices = new Map(items.map((item) => [item.id, item]));
      pricesByRegion.set(config.cc, prices);
      await track(
        config.cc,
        config.items.map((item) => item.id),
      );
    }

    const hits: string[] = [];
    const notified = { ...config.notified };

    for (const watched of config.items) {
      const item = prices.get(watched.id);
      if (!item || item.final === null) continue;

      const discountOk = config.minDiscount > 0 && item.discount >= config.minDiscount;
      const priceOk = config.maxPrice !== null && item.final <= config.maxPrice;
      if (!discountOk && !priceOk) continue;

      // Уже сообщали об этой или более низкой цене — молчим.
      const previous = notified[String(watched.id)];
      if (typeof previous === "number" && item.final >= previous) continue;

      notified[String(watched.id)] = item.final;
      const price = item.formatted ?? formatMoney(item.final, item.currency);
      hits.push(
        `• <a href="https://store.steampowered.com/app/${item.id}/">${escapeHtml(item.name)}</a>` +
          ` — <b>${escapeHtml(price)}</b>` +
          (item.discount > 0 ? ` (−${item.discount}%)` : "") +
          (watched.parentName ? `\n  <i>${escapeHtml(watched.parentName)}</i>` : ""),
      );
    }

    if (hits.length === 0) continue;

    const message = [`🎮 <b>Скидки на отслеживаемые DLC</b>`, "", ...hits].join("\n");
    if (await sendTelegram(config.telegramChatId, message)) {
      await updateNotified(token, notified);
      sent += 1;
    }
  }

  return sent;
}

import { kv } from "./kv";

/** Подписка на уведомления о скидках. Привязана к токену, а не к аккаунту. */
export interface WatchConfig {
  token: string;
  cc: string;
  lang: string;
  telegramChatId: string | null;
  /** Уведомлять, если скидка не меньше этого значения (%). */
  minDiscount: number;
  /** Уведомлять, если цена не выше этой (в минимальных единицах валюты). null — не проверять. */
  maxPrice: number | null;
  items: WatchItem[];
  /** appid -> цена, о которой уже сообщили. Защита от ежедневного спама. */
  notified: Record<string, number>;
  updatedAt: string;
}

export interface WatchItem {
  id: number;
  name: string;
  parentName: string;
}

const MAX_ITEMS = 500;
const TOKEN_RE = /^[a-z0-9-]{8,64}$/;
const INDEX_KEY = "w:index";

const watchKey = (token: string) => `w:${token}`;

export function isValidToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

export async function readWatch(token: string): Promise<WatchConfig | null> {
  if (!isValidToken(token)) return null;
  const raw = await kv().get(watchKey(token));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WatchConfig;
  } catch {
    return null;
  }
}

/** Приводит присланный клиентом объект к безопасному виду. */
export function sanitizeWatch(token: string, input: unknown): WatchConfig {
  const source = (input ?? {}) as Partial<WatchConfig>;
  const items = Array.isArray(source.items) ? source.items : [];

  return {
    token,
    cc: typeof source.cc === "string" ? source.cc.slice(0, 4).toLowerCase() : "us",
    lang: typeof source.lang === "string" ? source.lang.slice(0, 24) : "english",
    telegramChatId:
      typeof source.telegramChatId === "string" && /^-?\d{1,20}$/.test(source.telegramChatId.trim())
        ? source.telegramChatId.trim()
        : null,
    minDiscount: clamp(Number(source.minDiscount) || 0, 0, 100),
    maxPrice:
      typeof source.maxPrice === "number" && Number.isFinite(source.maxPrice) && source.maxPrice > 0
        ? Math.round(source.maxPrice)
        : null,
    items: items
      .filter((item): item is WatchItem => typeof item?.id === "number" && item.id > 0)
      .slice(0, MAX_ITEMS)
      .map((item) => ({
        id: Math.round(item.id),
        name: String(item.name ?? "").slice(0, 200),
        parentName: String(item.parentName ?? "").slice(0, 200),
      })),
    notified: {},
    updatedAt: new Date().toISOString(),
  };
}

export async function writeWatch(config: WatchConfig): Promise<void> {
  const store = kv();
  const existing = await readWatch(config.token);
  const merged: WatchConfig = {
    ...config,
    // Историю уведомлений не теряем при обновлении подписки.
    notified: existing?.notified ?? {},
  };
  await store.set(watchKey(config.token), JSON.stringify(merged));
  await store.sadd(INDEX_KEY, config.token);
}

export async function updateNotified(
  token: string,
  notified: Record<string, number>,
): Promise<void> {
  const config = await readWatch(token);
  if (!config) return;
  await kv().set(watchKey(token), JSON.stringify({ ...config, notified }));
}

export async function deleteWatch(token: string): Promise<void> {
  if (!isValidToken(token)) return;
  await kv().del(watchKey(token));
  await kv().srem(INDEX_KEY, token);
}

export async function allWatchTokens(): Promise<string[]> {
  return kv().smembers(INDEX_KEY);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

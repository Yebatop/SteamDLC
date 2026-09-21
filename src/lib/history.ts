import { kv } from "./kv";
import type { PriceHistory, PricePoint } from "./steam/types";

/** Две недели точек хватает на график, два года — на «минимальную цену за всё время». */
const MAX_POINTS = 730;

const historyKey = (cc: string, appid: number) => `h:${cc.toLowerCase()}:${appid}`;
const trackKey = (cc: string) => `track:${cc.toLowerCase()}`;

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function parsePoints(raw: string | null): PricePoint[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (point): point is PricePoint =>
        typeof point === "object" &&
        point !== null &&
        typeof (point as PricePoint).d === "string" &&
        typeof (point as PricePoint).f === "number",
    );
  } catch {
    return [];
  }
}

function summarize(appid: number, points: PricePoint[]): PriceHistory {
  let min: number | null = null;
  let minDate: string | null = null;
  for (const point of points) {
    if (min === null || point.f < min) {
      min = point.f;
      minDate = point.d;
    }
  }
  return { appid, min, minDate, points };
}

/** История цен по списку DLC. Отсутствующие ключи возвращаются с пустой историей. */
export async function readHistories(cc: string, appids: number[]): Promise<PriceHistory[]> {
  const unique = [...new Set(appids)];
  if (unique.length === 0) return [];

  const raw = await kv().mget(unique.map((appid) => historyKey(cc, appid)));
  return unique.map((appid, index) => summarize(appid, parsePoints(raw[index])));
}

export interface PriceSample {
  appid: number;
  /** final, в минимальных единицах валюты */
  final: number;
  discount: number;
}

/** Дописывает сегодняшнюю точку. Повторный вызов за день перезаписывает её. */
export async function recordPrices(cc: string, samples: PriceSample[]): Promise<void> {
  const date = today();
  const store = kv();

  await Promise.all(
    samples.map(async (sample) => {
      const key = historyKey(cc, sample.appid);
      const points = parsePoints(await store.get(key));
      const withoutToday = points.filter((point) => point.d !== date);
      withoutToday.push({ d: date, f: sample.final, p: sample.discount });
      const trimmed = withoutToday.slice(-MAX_POINTS);
      await store.set(key, JSON.stringify(trimmed));
    }),
  );
}

/** Помечает DLC как отслеживаемые, чтобы cron собирал по ним цены. */
export async function track(cc: string, appids: number[]): Promise<void> {
  const store = kv();
  await Promise.all(appids.map((appid) => store.sadd(trackKey(cc), String(appid))));
}

export async function tracked(cc: string): Promise<number[]> {
  const members = await kv().smembers(trackKey(cc));
  return members.map(Number).filter((appid) => Number.isInteger(appid) && appid > 0);
}

export async function trackedRegions(): Promise<string[]> {
  return kv().smembers("track:regions");
}

export async function rememberRegion(cc: string): Promise<void> {
  await kv().sadd("track:regions", cc.toLowerCase());
}

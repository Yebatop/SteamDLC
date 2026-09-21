import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  currentBatchSize,
  fetchAppDetails,
  resetAdaptiveMode,
} from "../src/lib/steam/appdetails.ts";

/**
 * Тесты на самый хрупкий кусок: общение с витриной Steam. Именно здесь
 * неизвестное имя в filters роняло синхронизацию целиком.
 */

const OPTIONS = { cc: "ua", lang: "russian", purpose: "dlcList" as const };

interface Call {
  filters: string;
  appids: number[];
}

let calls: Call[] = [];

type Reply = { status?: number; body: unknown };

function stubFetch(handler: (call: Call, index: number) => Reply, delayMs = 0): void {
  calls = [];
  globalThis.fetch = (async (input: string | URL) => {
    const url = new URL(String(input));
    const call: Call = {
      filters: url.searchParams.get("filters") ?? "",
      appids: (url.searchParams.get("appids") ?? "").split(",").filter(Boolean).map(Number),
    };
    calls.push(call);

    const reply = handler(call, calls.length - 1);
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const body = typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body);
    return new Response(body, { status: reply.status ?? 200 });
  }) as typeof fetch;
}

const ok = (appids: number[]) =>
  Object.fromEntries(appids.map((id) => [String(id), { success: true, data: { dlc: [id * 10] } }]));

beforeEach(() => {
  resetAdaptiveMode();
});

test("успешный батч раскладывается по каждому appid", async () => {
  stubFetch((call) => ({ body: ok(call.appids) }));

  const { data, failed } = await fetchAppDetails([1, 2, 3], OPTIONS);

  assert.equal(failed, 0);
  assert.equal(calls.length, 1, "три appid должны уехать одним запросом");
  assert.deepEqual(data.get(2)?.dlc, [20]);
});

test("на 400 берётся следующий набор filters, а не падает вся загрузка", async () => {
  stubFetch((call) =>
    call.filters === "dlc" ? { status: 400, body: "null" } : { body: ok(call.appids) },
  );

  const { data, failed } = await fetchAppDetails([1, 2], OPTIONS);

  assert.equal(failed, 0);
  assert.equal(calls[0].filters, "dlc", "сначала пробуем лёгкий набор");
  assert.equal(calls[1].filters, "basic", "затем откатываемся на надёжный");
  assert.deepEqual(data.get(1)?.dlc, [10]);
});

test("обрезанный батч добирается поштучно", async () => {
  // Витрина отвечает только про первый appid — ровно то, чего не обещает документация.
  stubFetch((call) => ({ body: ok(call.appids.slice(0, 1)) }));

  const { data, failed } = await fetchAppDetails([1, 2, 3], OPTIONS);

  assert.equal(failed, 0);
  assert.equal(data.size, 3, "недостающие appid запрошены по одному");
  assert.deepEqual(data.get(3)?.dlc, [30]);
  assert.ok(calls.length > 1, "одним запросом здесь не обойтись");
});

test("success:false — это «нет в продаже», а не сбой", async () => {
  stubFetch(() => ({ body: { "1": { success: false } } }));

  const { data, failed } = await fetchAppDetails([1], OPTIONS);

  assert.equal(failed, 0, "недоступное DLC не должно считаться ошибкой");
  assert.equal(data.get(1), null);
});

test("упавший appid не отменяет остальные", async () => {
  stubFetch((call) => {
    if (call.appids.length > 1) return { status: 400, body: "null" };
    return call.appids[0] === 2 ? { status: 400, body: "null" } : { body: ok(call.appids) };
  });

  const { data, failed } = await fetchAppDetails([1, 2, 3], OPTIONS);

  assert.equal(failed, 1, "не смогли получить ровно один appid");
  assert.deepEqual(data.get(1)?.dlc, [10]);
  assert.equal(data.get(2), null);
  assert.deepEqual(data.get(3)?.dlc, [30]);
});

test("если не получилось ничего — это настоящая ошибка и о ней нужно сказать", async () => {
  stubFetch(() => ({ status: 400, body: "null" }));

  await assert.rejects(() => fetchAppDetails([1, 2], OPTIONS), /400/);
});

const many = (count: number, from = 1) => Array.from({ length: count }, (_, i) => from + i);

test("пара неизвестных Steam appid не ломает батчинг остальным", async () => {
  // Делистнутые игры просто отсутствуют в ответе — это норма, а не поломка.
  stubFetch((call) => ({ body: ok(call.appids.filter((id) => id > 2)) }));

  await fetchAppDetails(many(40), OPTIONS);

  assert.equal(currentBatchSize(), 40, "размер пачки должен остаться прежним");
});

test("обрезанный ответ уменьшает пачку вдвое, а не до единицы", async () => {
  // Пришёл только первый appid из сорока — вот это уже похоже на обрезку.
  stubFetch((call) => ({ body: ok(call.appids.slice(0, 1)) }));

  await fetchAppDetails(many(40), OPTIONS);

  assert.equal(currentBatchSize(), 20, "падение сразу до 1 превращало запрос в 40 запросов");
});

test("бюджет времени останавливает работу, а успевшее — возвращается", async () => {
  stubFetch((call) => ({ body: ok(call.appids) }), 120);

  const { processed, data } = await fetchAppDetails(many(120), {
    ...OPTIONS,
    deadline: Date.now() + 60,
  });

  assert.ok(processed.length > 0, "что-то должно успеть обработаться");
  assert.ok(processed.length < 120, "остальное остаётся на следующий запрос");
  assert.equal(data.size, processed.length, "processed описывает ровно то, что получено");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyFilters,
  buildRows,
  collectGenres,
  computeStats,
  sortRows,
  DEFAULT_FILTERS,
} from "../src/lib/client/filters.ts";
import { EMPTY_OWNERSHIP } from "../src/lib/client/ownership.ts";
import { dlc, game } from "./helpers.ts";

const games = [
  game({ appid: 100, name: "Играная", playtime: 6000 }), // 100 ч
  game({ appid: 200, name: "Пылится", playtime: 0 }),
];

function rowsFor(items = [dlc({ id: 1 })], overrides: Partial<Parameters<typeof buildRows>[0]> = {}) {
  return buildRows({
    items,
    games,
    ownership: EMPTY_OWNERSHIP,
    bought: [],
    histories: {},
    ...overrides,
  });
}

test("купленное определяется и по userdata, и по ручной отметке", () => {
  const items = [dlc({ id: 1 }), dlc({ id: 2 }), dlc({ id: 3 })];
  const rows = rowsFor(items, {
    ownership: { ...EMPTY_OWNERSHIP, owned: [1], wishlist: [2], importedAt: 1 },
    bought: [3],
  });

  assert.equal(rows[0].owned, true, "из userdata");
  assert.equal(rows[1].owned, false);
  assert.equal(rows[1].wishlisted, true);
  assert.equal(rows[2].owned, true, "отмечено вручную");
});

test("часы берутся из родительской игры", () => {
  const rows = rowsFor([dlc({ id: 1, parent: 100 }), dlc({ id: 2, parent: 200 })]);
  assert.equal(rows[0].playtimeHours, 100);
  assert.equal(rows[1].playtimeHours, 0);
});

test("минимум цены вычисляется по истории", () => {
  const rows = rowsFor([dlc({ id: 1, final: 10000 }), dlc({ id: 2, final: 15000 })], {
    histories: {
      1: { appid: 1, min: 10000, minDate: "2026-01-01", points: [] },
      2: { appid: 2, min: 9000, minDate: "2026-01-01", points: [] },
    },
  });

  assert.equal(rows[0].lowestEver, true, "цена равна историческому минимуму");
  assert.equal(rows[1].lowestEver, false, "было дешевле");
});

test("hideOwned убирает купленное", () => {
  const rows = rowsFor([dlc({ id: 1 }), dlc({ id: 2 })], {
    ownership: { ...EMPTY_OWNERSHIP, owned: [1], importedAt: 1 },
  });

  const shown = applyFilters(rows, { ...DEFAULT_FILTERS, hideOwned: true });
  assert.deepEqual(shown.map((row) => row.item.id), [2]);
});

test("maxPrice сравнивает копейки с рублями и пропускает бесплатное", () => {
  const rows = rowsFor([
    dlc({ id: 1, final: 19900 }), // 199
    dlc({ id: 2, final: 45000 }), // 450
    dlc({ id: 3, free: true, final: null, initial: null }),
  ]);

  const shown = applyFilters(rows, { ...DEFAULT_FILTERS, maxPrice: 200 });
  assert.deepEqual(shown.map((row) => row.item.id), [1, 3]);
});

test("minPlaytimeHours отсекает DLC к непройденным играм", () => {
  const rows = rowsFor([dlc({ id: 1, parent: 100 }), dlc({ id: 2, parent: 200 })]);
  const shown = applyFilters(rows, { ...DEFAULT_FILTERS, minPlaytimeHours: 10 });
  assert.deepEqual(shown.map((row) => row.item.id), [1]);
});

test("скрытое и недоступное убирается по умолчанию", () => {
  const rows = rowsFor([
    dlc({ id: 1 }),
    dlc({ id: 2, unavailable: true }),
    dlc({ id: 3, coming: true }),
    dlc({ id: 4 }),
  ], {
    ownership: { ...EMPTY_OWNERSHIP, ignored: [4], importedAt: 1 },
  });

  const shown = applyFilters(rows, DEFAULT_FILTERS);
  assert.deepEqual(shown.map((row) => row.item.id), [1]);
});

test("фильтр по жанру оставляет только совпадения", () => {
  const rows = rowsFor([
    dlc({ id: 1, genres: ["Strategy"] }),
    dlc({ id: 2, genres: ["Action", "RPG"] }),
  ]);

  const shown = applyFilters(rows, { ...DEFAULT_FILTERS, genres: ["RPG"] });
  assert.deepEqual(shown.map((row) => row.item.id), [2]);
});

test("поиск ищет и по названию DLC, и по названию игры", () => {
  const rows = rowsFor([
    dlc({ id: 1, name: "Bonus Pack", parent: 100 }),
    dlc({ id: 2, name: "Soundtrack", parent: 200 }),
  ]);

  assert.equal(applyFilters(rows, { ...DEFAULT_FILTERS, query: "bonus" }).length, 1);
  assert.equal(applyFilters(rows, { ...DEFAULT_FILTERS, query: "пылится" })[0].item.id, 2);
});

test("сортировка «сначала выгодное» учитывает наигранные часы", () => {
  const rows = rowsFor([
    dlc({ id: 1, parent: 200, discount: 50 }), // скидка та же, игра не запускалась
    dlc({ id: 2, parent: 100, discount: 50 }), // 100 часов наиграно
  ]);

  const sorted = sortRows(rows, "value");
  assert.equal(sorted[0].item.id, 2, "DLC к играной игре должно быть выше");
});

test("сортировка по цене кладёт DLC без цены в конец", () => {
  const rows = rowsFor([
    dlc({ id: 1, final: null }),
    dlc({ id: 2, final: 5000 }),
    dlc({ id: 3, final: 100 }),
  ]);

  assert.deepEqual(
    sortRows(rows, "price-asc").map((row) => row.item.id),
    [3, 2, 1],
  );
});

test("статистика считает сумму и экономию", () => {
  const rows = rowsFor([
    dlc({ id: 1, initial: 20000, final: 10000, discount: 50 }),
    dlc({ id: 2, initial: 30000, final: 30000 }),
  ]);

  const stats = computeStats(rows, rows);
  assert.equal(stats.sum, 40000);
  assert.equal(stats.sumFull, 50000);
  assert.equal(stats.discounted, 1);
  assert.equal(stats.currency, "RUB");
});

test("жанры собираются с подсчётом", () => {
  const rows = rowsFor([
    dlc({ id: 1, genres: ["Action", "RPG"] }),
    dlc({ id: 2, genres: ["Action"] }),
  ]);

  assert.deepEqual(collectGenres(rows), [
    { name: "Action", count: 2 },
    { name: "RPG", count: 1 },
  ]);
});

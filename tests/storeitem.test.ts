import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildGetItemsInput,
  parseStoreItems,
  toDlcItemFromStore,
} from "../src/lib/steam/storeitem.ts";

/** Ответ IStoreBrowseService/GetItems в том виде, в каком его отдаёт Steam. */
const body = {
  response: {
    store_items: [
      {
        id: 1001,
        appid: 1001,
        success: 1,
        visible: true,
        name: "Tours & Tournaments",
        type: 4,
        is_free: false,
        release: { steam_release_date: 1683158400, is_coming_soon: false },
        best_purchase_option: {
          final_price_in_cents: "19975",
          original_price_in_cents: "79900",
          formatted_final_price: "199,75₴",
          discount_pct: 75,
        },
        tags: [{ name: "Strategy" }, { name: "RPG" }],
      },
    ],
  },
};

test("ответ раскладывается по appid", () => {
  const parsed = parseStoreItems(body);
  assert.ok(parsed);
  assert.equal(parsed.size, 1);
  assert.equal(parsed.get(1001)?.name, "Tours & Tournaments");
});

test("незнакомый формат честно возвращает null", () => {
  // Это важнее, чем кажется: молчаливая пустота однажды уже стоила всех DLC.
  assert.equal(parseStoreItems({ response: {} }), null);
  assert.equal(parseStoreItems({}), null);
  assert.equal(parseStoreItems(null), null);
  assert.equal(parseStoreItems("не json"), null);
});

test("цены приходят строками и превращаются в числа", () => {
  const item = toDlcItemFromStore(1001, 100, parseStoreItems(body)!.get(1001), "UAH");

  assert.ok(item);
  assert.equal(item.final, 19975);
  assert.equal(item.initial, 79900);
  assert.equal(item.discount, 75);
  assert.equal(item.formatted, "199,75₴");
  assert.equal(item.currency, "UAH", "сервис не отдаёт код валюты — подставляем по региону");
  assert.equal(item.parent, 100);
  assert.deepEqual(item.genres, ["Strategy", "RPG"]);
  assert.equal(item.unavailable, false);
});

test("дата выхода приводится к виду, пригодному для сортировки", () => {
  const item = toDlcItemFromStore(1001, 100, parseStoreItems(body)!.get(1001), "UAH");
  assert.match(item!.released, /^\d{4}-\d{2}-\d{2}$/);
});

test("бесплатное DLC не считается недоступным", () => {
  const item = toDlcItemFromStore(2002, 200, { appid: 2002, success: 1, name: "OST", is_free: true }, "UAH");

  assert.ok(item);
  assert.equal(item.free, true);
  assert.equal(item.final, null);
  assert.equal(item.unavailable, false);
});

test("снятое с продажи помечается недоступным", () => {
  const item = toDlcItemFromStore(3003, 300, { appid: 3003, success: 2, name: "Gone" }, "UAH");

  assert.ok(item);
  assert.equal(item.unavailable, true);
});

test("бесполезный ответ возвращает null, чтобы переспросить через appdetails", () => {
  assert.equal(toDlcItemFromStore(1, 2, undefined, "UAH"), null);
  assert.equal(toDlcItemFromStore(1, 2, { appid: 1 }, "UAH"), null);
});

test("запрос собирается с нужным регионом и списком appid", () => {
  const input = JSON.parse(buildGetItemsInput([1, 2, 3], "ua", "russian"));

  assert.deepEqual(input.ids, [{ appid: 1 }, { appid: 2 }, { appid: 3 }]);
  assert.equal(input.context.country_code, "UA", "код страны нужен заглавными");
  assert.equal(input.context.language, "russian");
});

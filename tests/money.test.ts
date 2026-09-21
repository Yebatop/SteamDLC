import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMoney } from "../src/lib/money.ts";

/** В русской локали разделитель разрядов — неразрывный пробел, его и нормализуем. */
const plain = (value: string) => value.replace(/\s/gu, " ");

test("копейки превращаются в валюту", () => {
  assert.match(formatMoney(34900, "RUB"), /349/);
});

test("отсутствие цены показывается прочерком", () => {
  assert.equal(formatMoney(null, "RUB"), "—");
  assert.equal(formatMoney(undefined, "RUB"), "—");
});

test("неизвестный код валюты не роняет форматирование", () => {
  assert.match(formatMoney(1000, "XYZ"), /10/);
});

test("без валюты выводится просто число", () => {
  assert.equal(
    plain(formatMoney(150050, null)),
    plain((1500.5).toLocaleString("ru-RU", { maximumFractionDigits: 2 })),
  );
});

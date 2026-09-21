import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FILTER_CASCADES,
  firstFilters,
  isKnownFilterSet,
  nextFilters,
} from "../src/lib/steam/filters.ts";

test("каскады состоят только из имён, которые витрина знает", () => {
  for (const [purpose, cascade] of Object.entries(FILTER_CASCADES)) {
    for (const filters of cascade) {
      assert.ok(
        isKnownFilterSet(filters),
        `набор «${filters}» из каскада ${purpose} содержит незнакомое витрине имя`,
      );
    }
  }
});

test("именно это и сломалось: name/type/is_free витрине неизвестны", () => {
  assert.equal(isKnownFilterSet("name,type,is_free,dlc"), false);
  assert.equal(isKnownFilterSet("dlc"), true);
});

test("список DLC берём только из basic", () => {
  // Группа `dlc` принимается витриной, но отдаёт пустоту — проверено на живой
  // библиотеке: 297 игр и ноль найденных DLC.
  assert.equal(firstFilters("dlcList"), "basic");
  assert.deepEqual([...FILTER_CASCADES.dlcList], ["basic"]);
});

test("для самих DLC нужен basic: имя и тип приходят только в нём", () => {
  assert.match(firstFilters("item"), /basic/);
  for (const filters of FILTER_CASCADES.item) {
    assert.match(filters, /basic/, "иначе у DLC не будет названия");
  }
});

test("каскад перебирается до конца и затем останавливается", () => {
  const seen: string[] = [];
  let current: string | null = firstFilters("item");

  while (current) {
    seen.push(current);
    current = nextFilters("item", current);
  }

  assert.deepEqual(seen, [...FILTER_CASCADES.item]);
  assert.equal(nextFilters("item", FILTER_CASCADES.item.at(-1)!), null);
});

test("неизвестный текущий набор откатывает на начало каскада", () => {
  assert.equal(nextFilters("item", "name,type"), FILTER_CASCADES.item[0]);
});

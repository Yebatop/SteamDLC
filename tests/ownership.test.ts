import assert from "node:assert/strict";
import { test } from "node:test";
import { OwnershipParseError, parseUserdata } from "../src/lib/client/ownership.ts";

test("разбирает нормальный userdata", () => {
  const result = parseUserdata(
    JSON.stringify({
      rgOwnedApps: [10, 20, 20, 30],
      rgWishlist: [40],
      rgIgnoredApps: { "50": 0, "60": 0 },
    }),
  );

  assert.deepEqual(result.owned, [10, 20, 30], "дубликаты схлопываются");
  assert.deepEqual(result.wishlist, [40]);
  assert.deepEqual(result.ignored, [50, 60], "rgIgnoredApps приходит объектом");
  assert.ok(result.importedAt > 0);
});

test("rgIgnoredApps массивом тоже понимается", () => {
  const result = parseUserdata(JSON.stringify({ rgOwnedApps: [1], rgIgnoredApps: [2, 3] }));
  assert.deepEqual(result.ignored, [2, 3]);
});

test("не-JSON отвергается с понятной ошибкой", () => {
  assert.throws(() => parseUserdata("<html>login</html>"), OwnershipParseError);
});

test("пустая строка отвергается", () => {
  assert.throws(() => parseUserdata("   "), OwnershipParseError);
});

test("JSON без rgOwnedApps отвергается", () => {
  assert.throws(() => parseUserdata(JSON.stringify({ rgWishlist: [1] })), OwnershipParseError);
});

test("пустой список купленного считается разлогином", () => {
  assert.throws(() => parseUserdata(JSON.stringify({ rgOwnedApps: [] })), OwnershipParseError);
});

test("текст с мусором вокруг JSON всё равно разбирается", () => {
  // Так выглядит «выделить всё» на телефоне: адрес сверху, подписи снизу.
  const messy = `store.steampowered.com/dynamicstore/userdata/
{"rgOwnedApps":[10,20],"rgWishlist":[30]}
Готово`;

  const result = parseUserdata(messy);
  assert.deepEqual(result.owned, [10, 20]);
  assert.deepEqual(result.wishlist, [30]);
});

test("перенос строк внутри JSON не мешает", () => {
  const wrapped = '{"rgOwnedApps":[\n1,\n2\n],\n"rgWishlist":[]}';
  assert.deepEqual(parseUserdata(wrapped).owned, [1, 2]);
});

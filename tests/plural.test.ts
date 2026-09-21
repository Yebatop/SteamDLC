import assert from "node:assert/strict";
import { test } from "node:test";
import { plural } from "../src/lib/plural.ts";

const позиция = (count: number) => plural(count, "позицию", "позиции", "позиций");

test("склонение по последней цифре", () => {
  assert.equal(позиция(1), "позицию");
  assert.equal(позиция(2), "позиции");
  assert.equal(позиция(4), "позиции");
  assert.equal(позиция(5), "позиций");
  assert.equal(позиция(21), "позицию");
  assert.equal(позиция(102), "позиции");
});

test("11–14 — исключение", () => {
  for (const count of [11, 12, 13, 14, 111, 112]) {
    assert.equal(позиция(count), "позиций", `${count}`);
  }
});

test("ноль и отрицательные не ломают правило", () => {
  assert.equal(позиция(0), "позиций");
  assert.equal(позиция(-2), "позиции");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanDetail,
  describeSteamError,
  SteamApiError,
  SteamHttpError,
  STEAM_STORE_HOST,
  STEAM_WEB_API_HOST,
} from "../src/lib/steam/errors.ts";

test("403 от Web API читается как проблема с ключом, а не с доступностью", () => {
  const described = describeSteamError(
    new SteamHttpError("Steam ответил 403", 403, false, STEAM_WEB_API_HOST, "Access is denied."),
  );

  assert.equal(described.code, "bad_api_key");
  assert.equal(described.status, 400, "это ошибка ввода, а не сбой Steam");
  assert.match(described.message, /ключ/i);
  assert.match(described.message, /Access is denied/, "причина от Steam попадает в текст");
});

test("401 от Web API трактуется так же, как 403", () => {
  const described = describeSteamError(
    new SteamHttpError("Steam ответил 401", 401, false, STEAM_WEB_API_HOST),
  );
  assert.equal(described.code, "bad_api_key");
});

test("403 от витрины — это блокировка IP, а не ключ", () => {
  const described = describeSteamError(
    new SteamHttpError("Steam ответил 403", 403, false, STEAM_STORE_HOST),
  );

  assert.equal(described.code, "store_forbidden");
  assert.equal(described.status, 502);
  assert.doesNotMatch(described.message, /ключ/i, "про ключ здесь говорить нельзя — он ни при чём");
});

test("429 остаётся отдельным случаем с подсказкой продолжить", () => {
  const described = describeSteamError(
    new SteamHttpError("429", 429, true, STEAM_STORE_HOST),
  );

  assert.equal(described.code, "rate_limited");
  assert.equal(described.status, 429);
  assert.match(described.message, /Продолжить/);
});

test("нулевой статус означает отсутствие соединения", () => {
  const described = describeSteamError(
    new SteamHttpError("нет ответа", 0, true, STEAM_WEB_API_HOST, "fetch failed"),
  );

  assert.equal(described.code, "offline");
  assert.match(described.message, new RegExp(STEAM_WEB_API_HOST));
});

test("прочие статусы показываются с кодом и хостом", () => {
  const described = describeSteamError(
    new SteamHttpError("502", 502, true, STEAM_STORE_HOST, "Bad gateway"),
  );

  assert.equal(described.code, "upstream");
  assert.match(described.message, /502/);
  assert.match(described.message, new RegExp(STEAM_STORE_HOST));
});

test("логические ошибки делятся на пользовательские и серверные", () => {
  assert.equal(describeSteamError(new SteamApiError("нет ключа", "no_key")).status, 400);
  assert.equal(
    describeSteamError(new SteamApiError("профиль закрыт", "private_profile")).status,
    502,
  );
});

test("неизвестное исключение не теряет сообщение", () => {
  assert.equal(describeSteamError(new Error("что-то своё")).message, "что-то своё");
  assert.equal(describeSteamError("строка").code, "internal");
});

test("cleanDetail вычищает разметку и обрезает длину", () => {
  const raw = "<html><body><h1>Forbidden</h1>  Access is denied.\n</body></html>";
  assert.equal(cleanDetail(raw), "Forbidden Access is denied.");
  assert.equal(cleanDetail("a".repeat(500), 10).length, 10);
});

test("400 от витрины объясняет причину, а не просто повторяет код", () => {
  const described = describeSteamError(
    new SteamHttpError("Steam ответил 400", 400, false, STEAM_STORE_HOST),
  );

  assert.equal(described.code, "bad_request");
  assert.match(described.message, /набор/i, "нужно назвать настоящую причину");
});

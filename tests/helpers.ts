import type { DlcItem, OwnedGame } from "../src/lib/steam/types.ts";

export function dlc(overrides: Partial<DlcItem> & { id: number }): DlcItem {
  return {
    parent: 100,
    name: `DLC ${overrides.id}`,
    type: "dlc",
    free: false,
    coming: false,
    released: "1 Jan, 2020",
    currency: "RUB",
    initial: 20000,
    final: 20000,
    discount: 0,
    formatted: "200 руб.",
    genres: ["Action"],
    features: ["Single-player"],
    unavailable: false,
    ...overrides,
  };
}

export function game(overrides: Partial<OwnedGame> & { appid: number }): OwnedGame {
  return {
    name: `Game ${overrides.appid}`,
    playtime: 0,
    playtime2w: 0,
    lastPlayed: 0,
    ...overrides,
  };
}

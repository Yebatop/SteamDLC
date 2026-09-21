import { DEFAULT_REGION } from "../regions";

export interface Settings {
  profile: string;
  /** Ключ Steam Web API. Хранится только в localStorage браузера. */
  apiKey: string;
  cc: string;
  lang: string;
}

export const DEFAULT_SETTINGS: Settings = {
  profile: "",
  apiKey: "",
  cc: DEFAULT_REGION.cc,
  lang: DEFAULT_REGION.lang,
};

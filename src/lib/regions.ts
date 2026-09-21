export interface Region {
  cc: string;
  label: string;
  /** Язык витрины Steam — влияет на язык названий и дат. */
  lang: string;
}

/**
 * Параметр `cc` меняет только валюту, в которой Steam показывает цену.
 * Купить по этой цене можно лишь в своём регионе аккаунта — поэтому в интерфейсе
 * честно просим выбрать свой реальный регион, а не самый дешёвый.
 */
export const REGIONS: Region[] = [
  { cc: "ru", label: "Россия (₽)", lang: "russian" },
  { cc: "kz", label: "Казахстан (₸)", lang: "russian" },
  { cc: "by", label: "Беларусь (BYN)", lang: "russian" },
  { cc: "ua", label: "Украина ($)", lang: "russian" },
  { cc: "am", label: "Армения (֏)", lang: "russian" },
  { cc: "ge", label: "Грузия (₾)", lang: "russian" },
  { cc: "tr", label: "Турция (₺)", lang: "english" },
  { cc: "us", label: "США ($)", lang: "english" },
  { cc: "de", label: "Германия (€)", lang: "english" },
  { cc: "pl", label: "Польша (zł)", lang: "english" },
  { cc: "gb", label: "Великобритания (£)", lang: "english" },
];

export const DEFAULT_REGION = REGIONS[0];

export function regionByCc(cc: string): Region {
  return REGIONS.find((region) => region.cc === cc.toLowerCase()) ?? DEFAULT_REGION;
}

/** Валидация пользовательского ввода перед походом в Steam. */
export function safeCc(value: unknown): string {
  return typeof value === "string" && /^[a-z]{2}$/i.test(value) ? value.toLowerCase() : "us";
}

export function safeLang(value: unknown): string {
  return typeof value === "string" && /^[a-z]{2,20}$/i.test(value) ? value.toLowerCase() : "english";
}

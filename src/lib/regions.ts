export interface Region {
  cc: string;
  label: string;
  /** Язык витрины Steam — влияет на язык названий и дат. */
  lang: string;
  /**
   * Код валюты. Нужен там, где Steam отдаёт только сумму без кода: по нему
   * форматируются итоги выбранного.
   */
  currency: string;
}

/**
 * Параметр `cc` меняет только валюту, в которой Steam показывает цену.
 * Купить по этой цене можно лишь в своём регионе аккаунта — поэтому в интерфейсе
 * честно просим выбрать свой реальный регион, а не самый дешёвый.
 */
export const REGIONS: Region[] = [
  { cc: "ru", label: "Россия (₽)", lang: "russian", currency: "RUB" },
  { cc: "kz", label: "Казахстан (₸)", lang: "russian", currency: "KZT" },
  { cc: "by", label: "Беларусь (BYN)", lang: "russian", currency: "BYN" },
  { cc: "ua", label: "Украина ($)", lang: "russian", currency: "USD" },
  { cc: "am", label: "Армения (֏)", lang: "russian", currency: "AMD" },
  { cc: "ge", label: "Грузия (₾)", lang: "russian", currency: "GEL" },
  { cc: "tr", label: "Турция (₺)", lang: "english", currency: "TRY" },
  { cc: "us", label: "США ($)", lang: "english", currency: "USD" },
  { cc: "de", label: "Германия (€)", lang: "english", currency: "EUR" },
  { cc: "pl", label: "Польша (zł)", lang: "english", currency: "PLN" },
  { cc: "gb", label: "Великобритания (£)", lang: "english", currency: "GBP" },
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

/** Код валюты региона: Steam-сервисы не всегда отдают его сами. */
export function currencyFor(cc: string): string {
  return regionByCc(cc).currency;
}

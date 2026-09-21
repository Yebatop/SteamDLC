/**
 * Наборы параметра `filters` для store/api/appdetails.
 *
 * Витрина принимает только известные ей имена групп. На неизвестное имя
 * (например `name` или `is_free`) она отвечает 400 с телом `null` — молча
 * проигнорировать его она не может. Поэтому здесь перечислены исключительно
 * документированные группы, а порядок внутри каскада — от самого лёгкого
 * ответа к самому надёжному.
 */

export type FilterPurpose = "dlcList" | "item";

export const FILTER_CASCADES: Record<FilterPurpose, readonly string[]> = {
  /**
   * Только basic. Группа `dlc` выглядит логичной и даже не вызывает ошибки,
   * но витрина отдаёт по ней пустой объект данных — на библиотеке в 297 игр
   * это дало ровно ноль найденных DLC. Список дополнений приходит внутри
   * basic, пусть и вместе с ненужными описаниями.
   */
  dlcList: ["basic"],
  // Для самих DLC нужны имя и тип, а они приходят только в составе basic.
  item: [
    "basic,price_overview,release_date,genres,categories",
    "basic,price_overview,release_date",
    "basic,price_overview",
    "basic",
  ],
};

export function firstFilters(purpose: FilterPurpose): string {
  return FILTER_CASCADES[purpose][0];
}

/** Следующий по надёжности набор или null, если запасных больше нет. */
export function nextFilters(purpose: FilterPurpose, current: string): string | null {
  const cascade = FILTER_CASCADES[purpose];
  const index = cascade.indexOf(current);
  if (index < 0) return cascade[0] === current ? null : cascade[0];
  return index + 1 < cascade.length ? cascade[index + 1] : null;
}

/** Значения, которые витрина точно понимает: страховка от опечаток в каскадах. */
export const KNOWN_FILTERS = new Set([
  "basic",
  "categories",
  "controller_support",
  "demos",
  "developers",
  "dlc",
  "fullgame",
  "genres",
  "metacritic",
  "movies",
  "packages",
  "package_groups",
  "platforms",
  "price_overview",
  "publishers",
  "recommendations",
  "release_date",
  "screenshots",
  "supported_languages",
  "website",
]);

export function isKnownFilterSet(filters: string): boolean {
  return filters
    .split(",")
    .map((value) => value.trim())
    .every((value) => value.length > 0 && KNOWN_FILTERS.has(value));
}

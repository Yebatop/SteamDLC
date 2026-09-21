/** Steam отдаёт цены в минимальных единицах валюты: 34900 = 349.00 */
export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
  locale = "ru-RU",
): string {
  if (amount === null || amount === undefined) return "—";
  const value = amount / 100;
  if (!currency) {
    return value.toLocaleString(locale, { maximumFractionDigits: 2 });
  }
  try {
    return value.toLocaleString(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    });
  } catch {
    return `${value.toLocaleString(locale, { maximumFractionDigits: 2 })} ${currency}`;
  }
}

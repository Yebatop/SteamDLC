/**
 * Русское склонение после числительного: 1 позицию, 2 позиции, 5 позиций.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(count));
  const lastTwo = abs % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return many;

  const last = abs % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

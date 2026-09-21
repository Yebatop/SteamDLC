"use client";

import { formatMoney } from "@/lib/money";
import type { Stats } from "@/lib/client/filters";

export default function StatsRow({ stats, games }: { stats: Stats; games: number }) {
  const savings = stats.sumFull - stats.sum;

  const cells: Array<{ label: string; value: string; tone?: string }> = [
    { label: "Игр в библиотеке", value: String(games) },
    { label: "Всего DLC найдено", value: String(stats.total) },
    { label: "Уже куплено", value: String(stats.owned) },
    { label: "Показано сейчас", value: String(stats.shown), tone: "text-steam" },
    {
      label: "Сумма показанного",
      value: formatMoney(stats.sum, stats.currency),
      tone: "text-slate-100",
    },
    {
      label: "Со скидкой",
      value: savings > 0 ? `${stats.discounted} · −${formatMoney(savings, stats.currency)}` : "—",
      tone: savings > 0 ? "text-sale" : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((cell) => (
        <div key={cell.label} className="bg-panel px-3 py-2.5">
          <div className="text-[11px] tracking-wide text-muted uppercase">{cell.label}</div>
          <div className={`mt-0.5 text-lg font-semibold ${cell.tone ?? "text-slate-200"}`}>
            {cell.value}
          </div>
        </div>
      ))}
    </div>
  );
}

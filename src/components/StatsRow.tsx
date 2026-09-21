"use client";

import { formatMoney } from "@/lib/money";
import type { Stats } from "@/lib/client/filters";

export default function StatsRow({ stats, games }: { stats: Stats; games: number }) {
  const savings = stats.sumFull - stats.sum;

  const cells = [
    { label: "Игр в библиотеке", value: String(games), accent: "" },
    { label: "Дополнений найдено", value: String(stats.total), accent: "" },
    { label: "Уже куплено", value: String(stats.owned), accent: "" },
    { label: "Показано сейчас", value: String(stats.shown), accent: "text-steam" },
    {
      label: "Сумма показанного",
      value: formatMoney(stats.sum, stats.currency),
      accent: "text-slate-50",
    },
    {
      label: "Экономия со скидок",
      value: savings > 0 ? formatMoney(savings, stats.currency) : "—",
      accent: savings > 0 ? "text-sale" : "",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-xl border border-line bg-panel px-3.5 py-3 transition-colors hover:border-steam-dim/60"
        >
          <div className="truncate text-[11px] tracking-wide text-muted uppercase">
            {cell.label}
          </div>
          <div
            className={`mt-1 truncate text-xl font-semibold ${cell.accent || "text-slate-200"}`}
          >
            {cell.value}
          </div>
        </div>
      ))}
    </div>
  );
}

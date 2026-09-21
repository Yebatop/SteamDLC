import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SteamDLC — все DLC твоей библиотеки в одном списке",
  description:
    "Собирает DLC ко всем играм из твоей библиотеки Steam: что не куплено, что со скидкой, " +
    "что к играм, в которые ты реально играешь. С историей цен и уведомлениями.",
};

export const viewport: Viewport = {
  themeColor: "#0b1219",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

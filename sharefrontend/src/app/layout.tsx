import type { Metadata } from "next";
import { Noto_Sans_SC, Varela_Round } from "next/font/google";

import "./globals.css";

const bodyFont = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const displayFont = Varela_Round({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CardShare",
  description: "Multi-tenant storefront for browsing and redeeming shared cards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="antialiased">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>{children}</body>
    </html>
  );
}

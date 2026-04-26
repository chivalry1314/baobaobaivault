import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}

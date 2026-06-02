import type { Metadata } from "next";

import { ShareSessionProvider } from "@/components/share/session-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "CardShare",
  description: "Storefront for browsing and redeeming shared cards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="antialiased" data-scroll-behavior="smooth">
      <body>
        <ShareSessionProvider>{children}</ShareSessionProvider>
      </body>
    </html>
  );
}

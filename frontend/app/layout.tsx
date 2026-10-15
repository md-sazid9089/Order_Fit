import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "OrderFit — Stress-Test Orders, Protect Cash Flow, and Plan Safe Terms",
  description:
    "Evaluate purchase orders, protect day-by-day cash runway, and negotiate safe supplier terms with deterministic precision. Built for international growing brands.",
  icons: {
    icon: [
      { url: "/OrderFit.png", type: "image/png" },
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/OrderFit.png",
    apple: "/OrderFit.png",
  },
  keywords: [
    "OrderFit",
    "order decision copilot",
    "purchase order risk",
    "cash flow runway",
    "working capital planning",
    "delay tolerance scan",
    "deterministic decision engine",
    "supplier terms negotiation",
    "Settle alternative",
  ],
  openGraph: {
    title: "OrderFit — Stress-Test Orders, Protect Cash Flow, and Plan Safe Terms",
    description:
      "A sale is not cash in the bank. OrderFit verifies day-by-day cash feasibility, stress-tests against customer late payments, and sizes safe commercial terms.",
    type: "website",
    locale: "en_US",
  },
};

import { ConnectionIndicator } from "@/components/layout/connection-indicator";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="min-h-full antialiased" style={{ backgroundColor: "#F7F6F5" }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=Sora:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#F7F6F5] text-[#1A1A1A] font-sans antialiased">
        <Providers>
          {children}
          <ConnectionIndicator />
        </Providers>
      </body>
    </html>
  );
}

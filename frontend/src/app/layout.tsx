import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

// Display face for headings and big numbers; a calm grotesque for everything else.
const display = Bricolage_Grotesque({ variable: "--font-display-face", subsets: ["latin"] });
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BudgetBuddy",
  description: "Know what's left of your allowance before it runs out.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

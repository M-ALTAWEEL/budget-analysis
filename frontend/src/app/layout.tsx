import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Readex_Pro } from "next/font/google";

import { PRELOADER_SCRIPT } from "@/components/brand/preloaderScript";

import { Providers } from "./providers";
import "./globals.css";
import "./brand.css";

// Display face for headings and big numbers; a calm grotesque for everything else.
// "latin-ext" adds Turkish letters (ğ, ş, ı, İ). Arabic gets its own font.
const display = Bricolage_Grotesque({
  variable: "--font-display-face",
  subsets: ["latin", "latin-ext"],
});
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin", "latin-ext"] });
const arabic = Readex_Pro({ variable: "--font-arabic", subsets: ["arabic", "latin"] });

// Vercel sets the production domain at build time; share cards need absolute image links.
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://budgetanalysis.vercel.app";
const DESCRIPTION = "Know what's left of your allowance before it runs out.";

// The icons and the share card come from the brand kit (brand/ibudgi-logo-kit/web), in public/.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "ibudgi",
  description: DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "ibudgi",
    description: DESCRIPTION,
    siteName: "ibudgi",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "ibudgi" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
};

// Runs before the page is painted: applies the saved language direction and theme,
// so an Arabic page never flashes left-to-right and a dark page never flashes white.
// React state takes over after hydration (I18nProvider, ThemeProvider).
const EARLY_SCRIPT = `(function(){try{
var d=document.documentElement;
var l=localStorage.getItem("bb-locale");
if(l==="en"||l==="ar"||l==="tr"){d.lang=l;d.dir=l==="ar"?"rtl":"ltr";}
var t=localStorage.getItem("bb-theme");
var dark=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
d.dataset.theme=dark?"dark":"light";
var a=localStorage.getItem("bb-accent");
if(a==="pine"||a==="ocean"||a==="plum"||a==="graphite")d.dataset.accent=a;
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the early script changes lang/dir/data-theme on purpose
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${arabic.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: EARLY_SCRIPT }} />
        {/* First visit only: the ibudgi launch animation, before React (preloaderScript.ts). */}
        <script dangerouslySetInnerHTML={{ __html: PRELOADER_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

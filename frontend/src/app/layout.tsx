import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Montserrat, Readex_Pro } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

// Display face for headings and big numbers; a calm grotesque for everything else.
// "latin-ext" adds Turkish letters (ğ, ş, ı, İ). Arabic gets its own font.
const display = Bricolage_Grotesque({
  variable: "--font-display-face",
  subsets: ["latin", "latin-ext"],
});
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin", "latin-ext"] });
const arabic = Readex_Pro({ variable: "--font-arabic", subsets: ["arabic", "latin"] });
// Only for the name in the logo ("Budget" bold, "Analysis" regular).
const logo = Montserrat({ variable: "--font-logo-face", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Budget Analysis",
  description: "Know what's left of your allowance before it runs out.",
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
if(a==="ocean"||a==="plum"||a==="graphite")d.dataset.accent=a;
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the early script changes lang/dir/data-theme on purpose
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${arabic.variable} ${logo.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: EARLY_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

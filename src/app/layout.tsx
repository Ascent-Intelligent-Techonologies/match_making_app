import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Playfair_Display, Cormorant_Garamond, Inter } from "next/font/google";
import { getThemeColors } from "@/lib/data/settings";
import { isDefaultTheme, themeCssVars } from "@/lib/theme";
import "./globals.css";

const fontHeading = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const fontScript = Cormorant_Garamond({
  variable: "--font-script",
  subsets: ["latin"],
  style: ["italic"],
  weight: ["500", "600"],
});

const fontBody = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AnuRupa Matrimony | Where Destiny Aligns",
  description:
    "A private, curated matchmaking experience for high networth families.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Colours saved in Admin -> Settings are re-declared inline on <html>, which
  // outranks the `:root` rule in globals.css. While the palette is untouched we
  // emit nothing at all, so the stylesheet stays the single source of truth.
  const theme = await getThemeColors();
  const style = isDefaultTheme(theme) ? undefined : (themeCssVars(theme) as CSSProperties);

  return (
    <html
      lang="en"
      style={style}
      className={`${fontHeading.variable} ${fontScript.variable} ${fontBody.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-blush-50 text-ink-900">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Playfair_Display, Cormorant_Garamond, Inter } from "next/font/google";
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
  title: "Aura | Where Destiny Aligns",
  description:
    "A private, curated matchmaking experience for high networth families.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fontHeading.variable} ${fontScript.variable} ${fontBody.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-blush-50 text-ink-900">
        {children}
      </body>
    </html>
  );
}

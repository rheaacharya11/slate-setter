import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Slate Setter",
  description: "Theatrical box office analysis — weekend by weekend.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-[#0a0a0a]">
        <header className="border-b border-[#e5e5e5]">
          <div className="max-w-7xl mx-auto px-8 h-14 flex items-center justify-between">
            {/* Left spacer */}
            <div className="w-32" />

            {/* Centered wordmark */}
            <span className="font-serif font-black tracking-widest text-sm uppercase select-none">
              Slate Setter
            </span>

            {/* Right nav */}
            <div className="w-32 flex justify-end">
              <Link
                href="/compare"
                className="text-xs tracking-widest uppercase text-[#0a0a0a] hover:text-[#6b6b6b] transition-colors"
              >
                Compare →
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

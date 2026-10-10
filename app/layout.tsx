import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteChrome from "./components/SiteChrome";
import ScrollToTop from "./components/ScrollToTop";
import CartWishlistProvider from "./context/CartWishlistContext";
import { StoreHydrator } from "./lib/store";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Required for the product pages' openGraph images, which are catalogue
  // paths like "/vegetables/roma-tomato.jpg". Without a base URL Next warns at
  // build and resolves them against localhost.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
  title: "AgriCart Shopping",
  description: "Farm Fresh to Home",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-emerald-50 text-slate-900`}
      >
        <CartWishlistProvider>
          <StoreHydrator />
          <SiteChrome>{children}</SiteChrome>
          <ScrollToTop />
        </CartWishlistProvider>
      </body>
    </html>
  );
}
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { AuthProvider } from "@/lib/auth/auth-context";
import { CartProvider } from "@/lib/cart/cart-context";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://darra.com.ng";
const OG_DESCRIPTION =
  "Discover, buy, and sell digital products — eBooks, audio, and event tickets — on Darra.";

export const metadata: Metadata = {
  // Makes relative URLs (og-image, icons) resolve to absolute ones for scrapers.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Darra — Digital Products Marketplace",
    template: "%s · Darra",
  },
  description: OG_DESCRIPTION,
  applicationName: "Darra",
  openGraph: {
    type: "website",
    siteName: "Darra",
    url: SITE_URL,
    title: "Darra — Digital Products Marketplace",
    description: OG_DESCRIPTION,
    locale: "en_NG",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Darra" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Darra — Digital Products Marketplace",
    description: OG_DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <CartProvider>
            <LayoutWrapper>{children}</LayoutWrapper>
            <Toaster richColors position="top-right" />
            <Analytics />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

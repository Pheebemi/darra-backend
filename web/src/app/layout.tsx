import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemedToaster } from "@/components/themed-toaster";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth/auth-context";
import { CartProvider } from "@/lib/cart/cart-context";
import { Analytics } from "@vercel/analytics/next";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
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
  verification: {
    google: "GAQPK7xAhwMBIU0t4qFs-KRWcwU1CZuHfAAWLcbPxbI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // next-themes writes the theme class onto <html> before paint, which the
    // server render can't know about — suppressHydrationWarning scopes the
    // expected mismatch to this element only.
    //
    // The font .variable classes live here, not on <body>: Tailwind v4's
    // theme tokens (--font-sans, and Preflight's own default-font wiring)
    // are declared at :root, so their var() lookups resolve in :root's own
    // scope. If the custom property they point at is only defined on <body>
    // — a descendant of :root, not an ancestor — that lookup finds nothing
    // and silently falls through to the browser default font everywhere,
    // with no error. Declaring the variables on <html> instead puts them in
    // scope at :root itself, so the whole chain resolves correctly.
    <html lang="en" suppressHydrationWarning className={`${plusJakartaSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <ThemeProvider>
          <AuthProvider>
            <CartProvider>
              <LayoutWrapper>{children}</LayoutWrapper>
              <ThemedToaster />
              <Analytics />
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

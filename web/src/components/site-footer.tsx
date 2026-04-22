import { ShoppingBag } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-10">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4 lg:grid-cols-5">

            {/* Brand */}
            <div className="md:col-span-2">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                  <ShoppingBag className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <span className="text-sm font-semibold">Darra</span>
              </div>
              <p className="mb-5 max-w-xs text-xs text-muted-foreground leading-relaxed">
                Your trusted marketplace for digital products and creative assets. Secure payments, instant delivery.
              </p>
              <div className="flex gap-2">
                {[{ name: "Twitter", label: "𝕏" }, { name: "Instagram", label: "◎" }, { name: "Facebook", label: "f" }].map((s) => (
                  <a key={s.name} href="#" aria-label={s.name}
                    className="flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-primary hover:text-primary text-xs font-medium">
                    {s.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <p className="mb-3 text-xs font-semibold">Platform</p>
              <ul className="space-y-2">
                {[
                  { name: "Browse Products", href: "/products" },
                  { name: "Sell on Darra", href: "/dashboard/seller" },
                  { name: "My Account", href: "/dashboard/buyer" },
                  { name: "Support", href: "/support" },
                ].map((l) => (
                  <li key={l.name}>
                    <a href={l.href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">{l.name}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <p className="mb-3 text-xs font-semibold">Company</p>
              <ul className="space-y-2">
                {[
                  { name: "About Us", href: "/about" },
                  { name: "Careers", href: "/careers" },
                  { name: "Blog", href: "/blog" },
                  { name: "Contact", href: "/contact" },
                ].map((l) => (
                  <li key={l.name}>
                    <a href={l.href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">{l.name}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="mb-3 text-xs font-semibold">Legal</p>
              <ul className="space-y-2">
                {[
                  { name: "Privacy Policy", href: "/privacy" },
                  { name: "Terms of Service", href: "/terms" },
                  { name: "Cookie Policy", href: "/cookies" },
                  { name: "Refund Policy", href: "/refunds" },
                ].map((l) => (
                  <li key={l.name}>
                    <a href={l.href} className="text-xs text-muted-foreground transition-colors hover:text-foreground">{l.name}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 md:flex-row">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Darra. All rights reserved.</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Secure payments</span>
              <span>·</span>
              <span>Instant delivery</span>
              <span>·</span>
              <span>24/7 support</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-ink-dark">
      <div className="mx-auto max-w-7xl px-5 sm:px-16">
        <div className="py-14">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4 lg:grid-cols-5">

            {/* Brand */}
            <div className="md:col-span-2">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">
                  <img src="/logo.svg" alt="Darra" className="h-8 w-auto" />
                </div>
                <span className="text-lg font-semibold text-white">Darra</span>
              </div>
              <p className="mb-6 max-w-xs text-sm leading-relaxed text-gray-400">
                Your trusted marketplace for digital products and creative assets.
                Secure payments, instant delivery.
              </p>
              <div className="flex gap-2">
                {[{ name: "Twitter", label: "𝕏" }, { name: "Instagram", label: "◎" }, { name: "Facebook", label: "f" }].map((s) => (
                  <a key={s.name} href="#" aria-label={s.name}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-sm font-medium text-gray-400 transition-colors hover:border-brand-400 hover:text-brand-300">
                    {s.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div>
              <p className="mb-4 text-sm font-semibold text-white">Platform</p>
              <ul className="space-y-2.5">
                {[
                  { name: "Browse Products", href: "/products" },
                  { name: "Browse Stores", href: "/stores" },
                  { name: "Sell on Darra", href: "/dashboard/seller" },
                  { name: "My Account", href: "/dashboard/buyer" },
                ].map((l) => (
                  <li key={l.name}>
                    <a href={l.href} className="text-sm text-gray-400 transition-colors hover:text-brand-300">{l.name}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <p className="mb-4 text-sm font-semibold text-white">Company</p>
              <ul className="space-y-2.5">
                {[
                  { name: "About Us", href: "/about" },
                  { name: "Careers", href: "/careers" },
                  { name: "Blog", href: "/blog" },
                  { name: "FAQ", href: "/faq" },
                  { name: "Contact", href: "/contact" },
                ].map((l) => (
                  <li key={l.name}>
                    <a href={l.href} className="text-sm text-gray-400 transition-colors hover:text-brand-300">{l.name}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="mb-4 text-sm font-semibold text-white">Legal</p>
              <ul className="space-y-2.5">
                {[
                  { name: "Privacy Policy", href: "/privacy" },
                  { name: "Terms of Service", href: "/terms" },
                  { name: "Cookie Policy", href: "/cookies" },
                  { name: "Refund Policy", href: "/refunds" },
                ].map((l) => (
                  <li key={l.name}>
                    <a href={l.href} className="text-sm text-gray-400 transition-colors hover:text-brand-300">{l.name}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 md:flex-row">
            <p className="text-xs text-gray-500">© {new Date().getFullYear()} Darra. All rights reserved.</p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
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

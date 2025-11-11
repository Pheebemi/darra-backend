export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200/50 bg-white/50 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-12">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4 lg:grid-cols-5">
            {/* Brand Section */}
            <div className="md:col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 text-xl font-bold tracking-tight mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </div>
                <span className="bg-gradient-to-br from-slate-900 to-blue-700 dark:from-slate-100 dark:to-blue-400 bg-clip-text text-transparent">
                  Darra
                </span>
              </div>
              <p className="max-w-md text-sm text-slate-600 dark:text-slate-400 mb-6">
                Your trusted platform for discovering and purchasing event tickets instantly. 
                Secure payments, instant delivery, and unforgettable experiences.
              </p>
              <div className="flex space-x-4">
                {/* Social Links */}
                {[
                  { name: 'Twitter', icon: '𝕏', href: '#' },
                  { name: 'Instagram', icon: '📷', href: '#' },
                  { name: 'Facebook', icon: '📘', href: '#' },
                ].map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-all hover:bg-blue-100 hover:text-blue-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-blue-900/50 dark:hover:text-blue-400"
                  >
                    <span className="text-sm">{social.icon}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Platform</h3>
              <ul className="space-y-3 text-sm">
                {[
                  { name: 'Browse Tickets', href: '/tickets' },
                  { name: 'Sell Tickets', href: '/dashboard/seller' },
                  { name: 'My Account', href: '/dashboard/buyer' },
                  { name: 'Support', href: '/support' },
                ].map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Company</h3>
              <ul className="space-y-3 text-sm">
                {[
                  { name: 'About Us', href: '/about' },
                  { name: 'Careers', href: '/careers' },
                  { name: 'Blog', href: '/blog' },
                  { name: 'Contact', href: '/contact' },
                ].map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Legal</h3>
              <ul className="space-y-3 text-sm">
                {[
                  { name: 'Privacy Policy', href: '/privacy' },
                  { name: 'Terms of Service', href: '/terms' },
                  { name: 'Cookie Policy', href: '/cookies' },
                  { name: 'Refund Policy', href: '/refunds' },
                ].map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-slate-600 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 border-t border-slate-200/50 pt-8 dark:border-slate-700/50">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                © {new Date().getFullYear()} Darra. All rights reserved.
              </div>
              
              {/* Additional Links */}
              <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 dark:text-slate-500">
                <span>Secure payments</span>
                <span>•</span>
                <span>Instant delivery</span>
                <span>•</span>
                <span>24/7 support</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
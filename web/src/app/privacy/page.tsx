import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Darra",
  description:
    "How Darra collects, uses, and protects your information on our marketplace for digital products and event tickets.",
};

const prose =
  "mx-auto max-w-3xl px-6 py-12 " +
  "[&_h2]:mt-9 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink " +
  "[&_p]:mb-3 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-gray-600 " +
  "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 " +
  "[&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-gray-600 " +
  "[&_a]:font-medium [&_a]:text-brand-600 [&_a]:underline";

export default function PrivacyPage() {
  return (
    <div className="bg-page">
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-12 text-center sm:flex-row sm:text-left">
          <img src="/illustrations/happy-customer.svg" alt="" className="w-40 shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">Legal</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">Privacy Policy</h1>
            <p className="mt-2 text-sm text-gray-500">Last updated: 30 July 2026</p>
          </div>
        </div>
      </div>

      <article className={prose}>
        <p>
          Darra (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates
          darra.com.ng, an online marketplace where creators sell digital
          products and event tickets. This Privacy Policy explains what
          information we collect, how we use it, and the choices you have.
        </p>

        <h2>1. Information we collect</h2>
        <ul>
          <li><strong>Account information</strong> — your name, email address, and password (stored encrypted). For sellers, your brand name and Nigerian bank account details used for payouts.</li>
          <li><strong>Transaction information</strong> — the products you buy or sell, order history, and amounts. We do <strong>not</strong> store your card details.</li>
          <li><strong>Content you provide</strong> — product listings, descriptions, images, and messages you send to support.</li>
          <li><strong>Usage data</strong> — pages viewed, device and browser information, and IP address, collected through cookies and similar technologies.</li>
        </ul>

        <h2>2. How we use your information</h2>
        <ul>
          <li>To operate the marketplace — accounts, listings, purchases, downloads, and event tickets.</li>
          <li>To process payments and seller payouts.</li>
          <li>To send transactional emails such as verification codes, receipts, and payout updates.</li>
          <li>To prevent fraud and keep the platform secure.</li>
          <li>To improve our services and respond to your support requests.</li>
        </ul>

        <h2>3. Payments</h2>
        <p>
          Payments are processed securely by our payment partners, Flutterwave
          and Paystack. Your full card details are entered on their systems —
          Darra never sees or stores them.
        </p>

        <h2>4. How we share information</h2>
        <ul>
          <li><strong>With sellers</strong> — when you buy, the seller receives the information needed to fulfil your order (for example, your name and email for delivery or ticket verification).</li>
          <li><strong>With service providers</strong> — payment processors, email delivery, hosting, and error monitoring, only as needed to run the service.</li>
          <li><strong>For legal reasons</strong> — where required by law, or to protect the rights, property, or safety of Darra, our users, or others.</li>
        </ul>
        <p>We do not sell your personal information.</p>

        <h2>5. Cookies</h2>
        <p>
          We use cookies to keep you signed in, remember your cart, and
          understand how the site is used. You can control or clear cookies in
          your browser settings, though some features may not work without them.
        </p>

        <h2>6. Data retention</h2>
        <p>
          We keep your information for as long as your account is active and as
          needed to comply with legal, tax, and fraud-prevention obligations.
        </p>

        <h2>7. Your rights</h2>
        <p>
          You can access, update, or delete your account information at any time,
          or ask us to delete your data by emailing{" "}
          <a href="mailto:support@darra.com.ng">support@darra.com.ng</a>. Some
          information may be retained where the law requires it.
        </p>

        <h2>8. Security</h2>
        <p>
          We protect your data with encryption in transit, hashed passwords, and
          access controls. No online service is completely secure, but we work
          continually to safeguard your information.
        </p>

        <h2>9. Children</h2>
        <p>
          Darra is intended for people aged 18 and over. We do not knowingly
          collect information from children.
        </p>

        <h2>10. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. We will post the revised
          date above and, for significant changes, let you know.
        </p>

        <h2>11. Contact us</h2>
        <p>
          Questions about this policy? Email{" "}
          <a href="mailto:support@darra.com.ng">support@darra.com.ng</a>.
        </p>
      </article>
    </div>
  );
}

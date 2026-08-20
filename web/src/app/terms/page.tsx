import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Darra",
  description:
    "The terms that govern buying and selling digital products and event tickets on Darra.",
};

const prose =
  "mx-auto max-w-3xl px-6 py-12 " +
  "[&_h2]:mt-9 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink " +
  "[&_p]:mb-3 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-body " +
  "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 " +
  "[&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-body " +
  "[&_a]:font-medium [&_a]:text-accent-link [&_a]:underline";

export default function TermsPage() {
  return (
    <div className="bg-page">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-12 text-center sm:flex-row sm:text-left">
          <img src="/illustrations/business-shop.svg" alt="" className="w-40 shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent-link">Legal</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">Terms of Service</h1>
            <p className="mt-2 text-sm text-subtle">Last updated: 30 July 2026</p>
          </div>
        </div>
      </div>

      <article className={prose}>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your use of Darra
          (darra.com.ng), a marketplace for digital products and event tickets.
          By creating an account or using Darra, you agree to these Terms.
        </p>

        <h2>1. Eligibility and accounts</h2>
        <p>
          You must be at least 18 years old to use Darra. You are responsible for
          the activity on your account and for keeping your password secure.
          Please provide accurate information and keep it up to date.
        </p>

        <h2>2. How Darra works</h2>
        <p>
          Buyers browse and purchase digital products and event tickets. Sellers
          list and sell their own digital products and events. Darra provides the
          platform that connects the two.
        </p>

        <h2>3. Seller terms</h2>
        <ul>
          <li>You may only list products you own or have the right to sell.</li>
          <li>Prohibited content includes anything illegal, infringing, harmful, or misleading.</li>
          <li>Darra charges a <strong>4% platform fee</strong> on each sale; you keep 96%.</li>
          <li>Payouts are made to a verified Nigerian bank account, with a minimum of NGN 1,000, normally within 12–14 hours of a valid request.</li>
          <li>You are responsible for your listings, delivering what you describe, and any taxes on your earnings.</li>
        </ul>

        <h2>4. Buyer terms</h2>
        <ul>
          <li>Digital products are delivered immediately after payment — as a download or a QR-coded ticket.</li>
          <li>Because products are digital and delivered instantly, sales are generally final. If something is wrong with your purchase, contact <a href="mailto:support@darra.com.ng">support@darra.com.ng</a> and we will review it.</li>
          <li>Each event ticket QR code is valid for a single entry and is verified at the event.</li>
        </ul>

        <h2>5. Payments</h2>
        <p>
          Payments are processed by Flutterwave and Paystack. All prices are in
          Nigerian Naira (NGN). Darra does not store your card details.
        </p>

        <h2>6. Intellectual property</h2>
        <p>
          Sellers retain ownership of the content they upload and grant Darra a
          licence to host and display it in order to operate the marketplace.
          Products you purchase are for your own use — you may not copy, resell,
          or redistribute them.
        </p>

        <h2>7. Prohibited conduct</h2>
        <ul>
          <li>No fraud, illegal activity, or infringement of others&apos; rights.</li>
          <li>No attempts to disrupt, overload, or gain unauthorised access to the platform.</li>
          <li>No reselling of other people&apos;s products without the right to do so.</li>
        </ul>

        <h2>8. Disclaimers and liability</h2>
        <p>
          Darra is a marketplace that connects buyers and sellers; we do not
          create the products that sellers list. The service is provided
          &quot;as is&quot;. To the fullest extent permitted by law, Darra is not
          liable for indirect or consequential damages, and our total liability
          for any claim is limited to the amount of the relevant transaction.
        </p>

        <h2>9. Termination</h2>
        <p>
          We may suspend or terminate accounts that violate these Terms or that
          put the platform or its users at risk.
        </p>

        <h2>10. Governing law</h2>
        <p>
          These Terms are governed by the laws of the Federal Republic of
          Nigeria.
        </p>

        <h2>11. Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. Continued use of Darra
          after changes take effect means you accept the updated Terms.
        </p>

        <h2>12. Contact us</h2>
        <p>
          Questions about these Terms? Email{" "}
          <a href="mailto:support@darra.com.ng">support@darra.com.ng</a>.
        </p>
      </article>
    </div>
  );
}

import { Metadata } from "next";
import { FaqAccordion, type FaqSection } from "@/components/faq-accordion";

export const metadata: Metadata = {
  title: "FAQ — Darra",
  description:
    "Answers to common questions about buying, selling, and getting paid on Darra.",
};

const sections: FaqSection[] = [
  {
    title: "General",
    items: [
      {
        q: "What is Darra?",
        a: "Darra (darra.com.ng) is a marketplace where creators sell digital products and event tickets, and buyers discover and purchase them with instant delivery.",
      },
      {
        q: "Do I need an account to browse?",
        a: "No — you can browse products and stores without an account. You'll need to sign up to buy, sell, or access your purchase library.",
      },
      {
        q: "Is Darra available outside Nigeria?",
        a: "Darra is built around the Nigerian market — prices are in Naira (NGN) and seller payouts go to Nigerian bank accounts. Buyers anywhere can still purchase and access digital products.",
      },
    ],
  },
  {
    title: "Buying",
    items: [
      {
        q: "How do I receive my purchase?",
        a: "Digital products are delivered immediately after payment — as a download in your library, or as a QR-coded ticket for events.",
      },
      {
        q: "Can I get a refund?",
        a: "Because products are digital and delivered instantly, sales are generally final. If something is wrong with your purchase, email support@darra.com.ng and we'll review it.",
      },
      {
        q: "How does the event ticket QR code work?",
        a: "Each ticket has a unique QR code valid for a single entry. It's verified at the event, so keep it accessible on your phone or printed.",
      },
      {
        q: "Where do I find what I've bought?",
        a: "Everything you've purchased is available in My Library, accessible from your account once you're signed in.",
      },
    ],
  },
  {
    title: "Selling",
    items: [
      {
        q: "How do I start selling on Darra?",
        a: "Create an account as a seller, set up your brand, and list your first product from your seller dashboard.",
      },
      {
        q: "What fees does Darra charge?",
        a: "Darra charges a 4% platform fee on each sale — you keep 96% of what you earn.",
      },
      {
        q: "When and how do I get paid?",
        a: "Payouts go to a verified Nigerian bank account, with a minimum payout of NGN 1,000, normally within 12–14 hours of a valid request.",
      },
    ],
  },
  {
    title: "Payments",
    items: [
      {
        q: "What payment methods are accepted?",
        a: "Payments are processed securely by Flutterwave and Paystack, supporting cards, bank transfers, and more.",
      },
      {
        q: "Is my payment information safe?",
        a: "Yes. Your card details are entered directly on our payment partners' systems — Darra never sees or stores them.",
      },
      {
        q: "What currency are prices shown in?",
        a: "All prices on Darra are in Nigerian Naira (NGN).",
      },
    ],
  },
  {
    title: "Account & support",
    items: [
      {
        q: "How do I reset my password?",
        a: "Use the \"Forgot password?\" link on the sign-in page to receive a reset link by email.",
      },
      {
        q: "How do I contact support?",
        a: "Email support@darra.com.ng and we'll get back to you.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="bg-page">
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-12 text-center sm:flex-row sm:text-left">
          <img src="/illustrations/web-search.svg" alt="" className="w-40 shrink-0" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">Support</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">
              Frequently Asked Questions
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Answers to common questions about buying, selling, and getting paid on Darra.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <FaqAccordion sections={sections} />

        <div className="mt-12 rounded-xl border border-gray-100 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-ink">Still have questions?</p>
          <p className="mt-1 text-sm text-gray-600">
            Can&apos;t find what you&apos;re looking for? Reach out and we&apos;ll help.
          </p>
          <a
            href="mailto:support@darra.com.ng"
            className="mt-4 inline-flex rounded-full bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}

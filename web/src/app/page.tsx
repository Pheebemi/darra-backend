"use client";
import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import { useEffect, useMemo, useState } from "react";
import { Search, ShoppingBag, Store, Shield, Download, QrCode, Wallet, ArrowRight, Sparkles } from "lucide-react";

type TicketTier = { id: number; name: string; price: number; is_sold_out?: boolean };
type Product = {
  id: number;
  slug?: string;
  title: string;
  description: string;
  price: number;
  product_type: string;
  cover_image?: string;
  ticket_tiers?: TicketTier[];
  is_ticket_event?: boolean;
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        // Only six are shown, so ask for six rather than the whole catalogue.
        const res = await fetch("/api/products?page_size=6");
        if (!res.ok) throw new Error();
        const data = await res.json();
        // The list endpoint is paginated ({results, pagination}); the array
        // form is kept as a fallback for an older backend.
        setProducts(Array.isArray(data) ? data : data.results || []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const featured = useMemo(() => products.slice(0, 6), [products]);

  return (
    <div className="min-h-screen bg-page">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 sm:px-16">
        <div className="grid grid-cols-1 items-center gap-8 py-16 sm:grid-cols-2 sm:gap-12 sm:py-24">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent-link">
              Digital marketplace
            </p>
            <h1 className="mb-5 text-4xl font-semibold leading-tight text-ink sm:text-5xl">
              Your marketplace for digital products
            </h1>
            <p className="mb-8 max-w-[45ch] text-lg text-body">
              Discover, buy, and sell eBooks, templates, courses & more.
              Instant delivery, secure payments.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-8 py-4 text-lg font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300 active:bg-brand-700"
              >
                <ShoppingBag className="h-5 w-5" />
                Browse Products
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full border border-brand-500 px-6 py-3 font-medium text-accent-link transition-colors hover:bg-brand-500 hover:text-white"
              >
                <Store className="h-4 w-4" />
                Start Selling
              </Link>
              <Link
                href="/stores"
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-3 font-medium text-accent-link transition-colors hover:text-accent-link"
              >
                Browse Stores <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Stat pills */}
            <div className="mt-10 flex flex-wrap gap-3">
              <div className="flex max-w-[28ch] items-center space-x-4 rounded-lg bg-inset p-3">
                <div className="rounded-sm bg-brand-softer p-3">
                  <Download className="h-4 w-4 text-accent-link" />
                </div>
                <p className="text-sm text-body">Instant delivery on every purchase</p>
              </div>
              <div className="flex max-w-[28ch] items-center space-x-4 rounded-lg bg-inset p-3">
                <div className="rounded-sm bg-brand-softer p-3">
                  <Shield className="h-4 w-4 text-accent-link" />
                </div>
                <p className="text-sm text-body">Secure payments, protected checkout</p>
              </div>
            </div>
          </div>

          {/* Hero illustration */}
          <div className="hidden sm:block">
            <img
              src="/illustrations/hero-shopping.svg"
              alt="Person shopping for digital products online"
              className="mx-auto w-full max-w-lg"
            />
          </div>
        </div>
      </section>

      {/* ── Featured products ────────────────────────────────────────── */}
      <section className="bg-page-soft py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-16">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-accent-link">
                Featured
              </p>
              <h2 className="text-3xl font-semibold text-ink sm:text-4xl">
                Fresh from our creators
              </h2>
            </div>
            <Link
              href="/products"
              className="hidden items-center gap-1 font-medium text-accent-link transition-colors hover:text-accent-link sm:inline-flex"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? [...Array(6)].map((_, i) => (
                  <div key={i} className="overflow-hidden rounded-3xl border border-line bg-surface">
                    <div className="h-52 animate-pulse bg-brand-soft" />
                    <div className="space-y-2 p-5">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-inset" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-inset" />
                      <div className="flex justify-between pt-1">
                        <div className="h-4 w-16 animate-pulse rounded bg-inset" />
                        <div className="h-8 w-16 animate-pulse rounded-full bg-inset" />
                      </div>
                    </div>
                  </div>
                ))
              : featured.length === 0
              ? (
                  <div className="col-span-full flex flex-col items-center justify-center rounded-3xl border border-dashed border-brand-200 bg-surface py-16 text-center">
                    <img
                      src="/illustrations/no-data.svg"
                      alt=""
                      className="mb-5 h-32 w-auto"
                    />
                    <p className="text-body">No products yet. Check back soon.</p>
                  </div>
                )
              : featured.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/products"
              className="inline-flex items-center gap-1 font-medium text-accent-link hover:text-accent-link"
            >
              View all products <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why Darra ────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-16">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-accent-link">
              Why Darra
            </p>
            <h2 className="text-3xl font-semibold text-ink sm:text-4xl">
              Built for creators and their customers
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Shield, title: "Secure Payments", body: "Protected by industry-standard encryption and trusted payment gateways." },
              { icon: Download, title: "Instant Download", body: "Buyers get access immediately after payment—no waiting." },
              { icon: QrCode, title: "QR Access Codes", body: "Every purchase includes a unique QR code for access verification." },
              { icon: Wallet, title: "Seller Tools", body: "Manage products, track orders, and withdraw earnings with ease." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex flex-col gap-3 rounded-2xl bg-brand-soft p-6 text-left">
                <div className="mb-1 inline-flex w-fit rounded-lg bg-brand-500 p-3">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-strong">{title}</h3>
                <p className="text-sm text-body">{body}</p>
              </div>
            ))}
          </div>

          {/* Creator strip */}
          <div className="mt-16 grid grid-cols-1 items-center gap-8 rounded-3xl bg-page-warm p-8 sm:grid-cols-2 sm:gap-12 sm:p-12">
            <img
              src="/illustrations/creativity.svg"
              alt="Creator working on digital products"
              className="mx-auto w-full max-w-sm"
            />
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-accent-link">
                For sellers
              </p>
              <h2 className="mb-4 text-3xl font-semibold text-ink sm:text-4xl">
                Turn your craft into income
              </h2>
              <p className="mb-6 text-body text-lg">
                Open your store in minutes. Upload eBooks, courses, art, music,
                or software — Darra handles payments, delivery, and access codes
                so you can focus on creating.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300 active:bg-brand-700"
              >
                <Sparkles className="h-4 w-4" />
                Start Selling
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Dark CTA ─────────────────────────────────────────────────── */}
      <section className="bg-brand-950 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-16">
          <div className="grid grid-cols-1 items-center gap-8 sm:grid-cols-2 sm:gap-12">
            <div>
              <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
                Ready to find your next favorite thing?
              </h2>
              <p className="mb-8 text-lg text-brand-200">
                Join thousands of buyers and sellers trading digital products on Darra.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-8 py-4 text-lg font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300"
                >
                  <Search className="h-5 w-5" />
                  Explore the marketplace
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-full border border-brand-300 px-6 py-3 font-medium text-brand-100 transition-colors hover:bg-white/10"
                >
                  Create an account
                </Link>
              </div>
            </div>
            <img
              src="/illustrations/happy-customer.svg"
              alt="Happy customer"
              className="mx-auto hidden w-full max-w-sm sm:block"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const price = (() => {
    if (product.is_ticket_event && product.ticket_tiers?.length) {
      const prices = product.ticket_tiers.filter((t) => !t.is_sold_out).map((t) => t.price);
      return prices.length ? Math.min(...prices) : null;
    }
    return product.price || null;
  })();
  const typeLabel = product.product_type
    ? product.product_type.charAt(0).toUpperCase() + product.product_type.slice(1).toLowerCase()
    : "Digital";

  return (
    <Link
      href={`/products/${product.slug || product.id}`}
      className="group overflow-hidden rounded-3xl border border-line bg-surface transition-shadow duration-300 hover:shadow-xl"
    >
      <div className="relative h-52 overflow-hidden bg-brand-soft">
        {product.cover_image ? (
          <SafeImage src={product.cover_image} alt={product.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ShoppingBag className="h-10 w-10 text-brand-300" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {typeLabel}
        </span>
      </div>
      <div className="p-5">
        <h3 className="truncate text-xl font-semibold text-strong transition-colors group-hover:text-accent-link">
          {product.title}
        </h3>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-semibold text-ink">
            {price !== null ? `₦${price.toLocaleString()}` : "Sold out"}
          </span>
          <span className="rounded-full border border-brand-500 px-4 py-1.5 text-sm font-medium text-accent-link transition-colors group-hover:bg-brand-500 group-hover:text-white">
            View
          </span>
        </div>
      </div>
    </Link>
  );
}

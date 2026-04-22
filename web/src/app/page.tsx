"use client";
import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { Search, ShoppingBag, Store, Shield, Download, Star, ArrowRight } from "lucide-react";

type TicketTier = { id: number; name: string; price: number; is_sold_out?: boolean };
type Product = {
  id: number;
  title: string;
  description: string;
  price: number;
  product_type: string;
  cover_image?: string;
  ticket_tiers?: TicketTier[];
  is_ticket_event?: boolean;
};

const PLACEHOLDER_GRADIENTS = [
  "from-violet-500 to-indigo-600",
  "from-blue-500 to-cyan-500",
  "from-fuchsia-500 to-purple-600",
  "from-emerald-500 to-teal-500",
  "from-orange-500 to-pink-500",
  "from-rose-500 to-red-500",
];

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/products");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const featured = useMemo(() => products.slice(0, 6), [products]);

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section className="border-b bg-background">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <Badge variant="secondary" className="mb-6 rounded-full">
              Digital marketplace
            </Badge>
            <h1 className="mb-5 text-5xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
              Your marketplace for{" "}
              <span className="text-primary">digital products</span>
            </h1>
            <p className="mb-8 text-lg text-muted-foreground">
              Discover, buy, and sell eBooks, templates, courses & more. Instant delivery, secure payments.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/products">
                  <ShoppingBag className="h-4 w-4" />
                  Browse Products
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/register">
                  <Store className="h-4 w-4" />
                  Start Selling
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Featured Products</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Handpicked digital goods from top sellers</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/products" className="gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? [...Array(6)].map((_, i) => (
                <div key={i} className="overflow-hidden rounded-lg border bg-card">
                  <div className="h-48 animate-pulse bg-muted" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                    <div className="flex justify-between pt-1">
                      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                      <div className="h-7 w-14 animate-pulse rounded-md bg-muted" />
                    </div>
                  </div>
                </div>
              ))
            : featured.length === 0
            ? (
                <div className="col-span-3 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
                  <ShoppingBag className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No products yet. Check back soon.</p>
                </div>
              )
            : featured.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-base font-semibold">Why creators choose Darra</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Shield, title: "Secure Payments", body: "Protected by industry-standard encryption and trusted payment gateways." },
              { icon: Download, title: "Instant Download", body: "Buyers get access immediately after payment—no waiting." },
              { icon: Star, title: "QR Access Codes", body: "Every purchase includes a unique QR code for access verification." },
              { icon: Store, title: "Seller Tools", body: "Manage products, track orders, and withdraw earnings with ease." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-lg border bg-card p-5">
                <div className="mb-3 inline-flex rounded-md border bg-primary/10 p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mb-1 text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
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
  const gradient = PLACEHOLDER_GRADIENTS[product.id % PLACEHOLDER_GRADIENTS.length];
  const typeLabel = product.product_type
    ? product.product_type.charAt(0).toUpperCase() + product.product_type.slice(1).toLowerCase()
    : "Digital";

  return (
    <Link
      href={`/products/${product.id}`}
      className="group overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40 hover:shadow-sm"
    >
      <div className="relative h-48 overflow-hidden bg-muted">
        {product.cover_image ? (
          <SafeImage src={product.cover_image} alt={product.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${gradient}`}>
            <ShoppingBag className="h-8 w-8 text-white/40" />
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {typeLabel}
        </span>
      </div>
      <div className="p-4">
        <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">{product.title}</p>
        <p className="mt-3 flex items-center justify-between">
          <span className="text-sm font-semibold">{price !== null ? `₦${price.toLocaleString()}` : "Sold out"}</span>
          <Button size="sm" className="h-7 rounded-md px-3 text-xs">View</Button>
        </p>
      </div>
    </Link>
  );
}

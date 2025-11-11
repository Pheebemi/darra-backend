"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Ticket, Shield, Zap, QrCode, Users } from "lucide-react";
import { SafeImage } from "@/components/safe-image";
import { useEffect, useMemo, useState } from "react";

type TicketTier = {
  id: number;
  name: string;
  price: number;
  is_sold_out?: boolean;
};

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

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/products");
        if (!res.ok) throw new Error("Failed to fetch products");
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch (_) {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const featuredProducts = useMemo(() => {
    return products.filter((p) => p.product_type === "event").slice(0, 3);
  }, [products]);
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-900">
        <div className="absolute inset-0 bg-grid-slate-900/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-400/10 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />
        
        <div className="relative mx-auto max-w-7xl px-4 py-24 md:py-32">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left Content */}
            <div className="flex flex-col justify-center space-y-8">
              <div className="space-y-6">
                <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-100/50 px-3 py-1 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  🎵 Your next unforgettable experience awaits
                </div>
                
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl bg-gradient-to-br from-slate-900 to-blue-700 dark:from-slate-100 dark:to-blue-400 bg-clip-text text-transparent">
                  Discover & Buy
                  <span className="block mt-2">Tickets Instantly</span>
                </h1>
                
                <p className="text-xl text-slate-600 dark:text-slate-300 max-w-lg">
                  Explore events, choose tiers, and checkout securely. Your tickets are 
                  delivered immediately with QR verification.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Button size="lg" className="rounded-xl h-12 px-6 text-base bg-blue-600 hover:bg-blue-700" asChild>
                  <Link href="/tickets">
                    <Ticket className="w-5 h-5 mr-2" />
                    Browse Tickets
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="rounded-xl h-12 px-6 text-base" asChild>
                  <Link href="/account/tickets">My Tickets</Link>
                </Button>
              </div>

              {/* Search Bar */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <Input 
                  placeholder="Search events, artists, venues..." 
                  className="pl-10 pr-4 py-3 rounded-xl border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm"
                />
              </div>
            </div>

            {/* Right Content - Feature Cards */}
            <div className="relative">
              <div className="grid grid-cols-2 gap-4 lg:gap-6">
                <div className="space-y-4 lg:space-y-6">
                  <FeatureCard 
                    icon={<Shield className="w-6 h-6" />}
                    title="Secure Payments"
                    description="Pay with trusted gateways. We verify and issue tickets instantly."
                    delay="0"
                  />
                  <FeatureCard 
                    icon={<Zap className="w-6 h-6" />}
                    title="Instant Delivery"
                    description="Receive tickets and receipts in seconds—ready to scan."
                    delay="200"
                  />
                </div>
                <div className="space-y-4 lg:space-y-6 mt-8">
                  <FeatureCard 
                    icon={<QrCode className="w-6 h-6" />}
                    title="QR Verification"
                    description="Each ticket includes a unique QR code for door checks."
                    delay="400"
                  />
                  <FeatureCard 
                    icon={<Users className="w-6 h-6" />}
                    title="Seller Tools"
                    description="Manage listings, tiers, and inventory with ease."
                    delay="600"
                  />
                </div>
              </div>
              
              {/* Background Decoration */}
              <div className="absolute -top-4 -right-4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-4 -left-4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Featured Tickets Section */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:py-24">
        <div className="mb-12 flex items-end justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Featured Tickets</h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Handpicked events you don&apos;t want to miss
            </p>
          </div>
          <Button variant="ghost" className="group rounded-xl" asChild>
            <Link href="/tickets">
              View All
              <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            [1, 2, 3].map((i) => (
              <Card key={i} className="group overflow-hidden rounded-2xl border-slate-200/50 bg-white/80 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/80">
                <div className="relative h-48 overflow-hidden">
                  <div className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-slate-700" />
                </div>
                <CardContent className="p-6">
                  <div className="h-6 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </CardContent>
              </Card>
            ))
          ) : featuredProducts.length === 0 ? (
            [
              "No featured events yet. Explore all tickets while we curate highlights.",
            ].map((msg, i) => (
              <Card key={i} className="rounded-2xl border-slate-200/50 bg-white/80 p-6 text-slate-600 dark:border-slate-700/50 dark:bg-slate-800/80 dark:text-slate-300">
                {msg}
              </Card>
            ))
          ) : (
            featuredProducts.map((product) => (
              <FeaturedTicketCard key={product.id} product={product} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description, delay }: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
  delay: string;
}) {
  return (
    <Card className="group relative overflow-hidden border-slate-200/50 bg-white/70 dark:border-slate-700/50 dark:bg-slate-800/70 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-lg rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
            {icon}
          </div>
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {description}
        </p>
      </CardContent>
      
      {/* Hover effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
    </Card>
  );
}

// Featured Ticket Card Component (uses real product)
function FeaturedTicketCard({ product }: { product: Product }) {
  const minPrice = (() => {
    if (product.is_ticket_event && product.ticket_tiers?.length) {
      const prices = product.ticket_tiers
        .filter((t) => !t.is_sold_out)
        .map((t) => t.price);
      return prices.length > 0 ? Math.min(...prices) : null;
    }
    return product.price || null;
  })();

  return (
    <Card className="group overflow-hidden rounded-2xl border-slate-200/50 bg-white dark:border-slate-700/50 dark:bg-slate-800 transition-all duration-300 hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-600">
      <div className="relative h-48 overflow-hidden">
        {product.cover_image ? (
          <SafeImage src={product.cover_image} alt={product.title} fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
        )}
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-xl font-bold text-white drop-shadow-md line-clamp-1">{product.title}</h3>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
      </div>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            {minPrice !== null ? (
              <p className="text-2xl font-bold text-slate-900 dark:text-white">₦{minPrice.toLocaleString()}</p>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">Sold out</p>
            )}
            <p className="text-sm text-slate-600 dark:text-slate-400">Starting price</p>
          </div>
          <Button className="rounded-xl transition-transform group-hover:scale-105" asChild>
            <Link href={`/tickets/${product.id}`}>View Details</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
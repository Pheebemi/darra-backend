"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ShoppingBag, X, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

interface TicketTier {
  id: number;
  name: string;
  price: number;
  remaining_quantity: number;
  is_sold_out: boolean;
}

interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  product_type: string;
  cover_image?: string;
  created_at: string;
  ticket_tiers?: TicketTier[];
  is_ticket_event?: boolean;
  seller_name: string;
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "ebook", label: "eBooks" },
  { id: "template", label: "Templates" },
  { id: "course", label: "Courses" },
  { id: "software", label: "Software" },
  { id: "music", label: "Music" },
  { id: "art", label: "Art" },
  { id: "digital", label: "Digital" },
  { id: "png", label: "Images" },
  { id: "event", label: "Events" },
];

const PLACEHOLDER_GRADIENTS = [
  "from-violet-500 to-indigo-600",
  "from-blue-500 to-cyan-500",
  "from-fuchsia-500 to-purple-600",
  "from-emerald-500 to-teal-500",
  "from-orange-500 to-pink-500",
  "from-rose-500 to-red-500",
];

function getMinPrice(p: Product): number | null {
  if (p.is_ticket_event && p.ticket_tiers?.length) {
    const prices = p.ticket_tiers.filter((t) => !t.is_sold_out).map((t) => t.price);
    return prices.length ? Math.min(...prices) : null;
  }
  return p.price || null;
}

function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const q = new URLSearchParams();
        if (search.trim()) q.set("search", search.trim());
        const res = await fetch(`/api/products${q.toString() ? `?${q}` : ""}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch (e: any) {
        toast.error(e.message || "Failed to load products");
      } finally {
        setLoading(false);
      }
    })();
  }, [search]);

  const filtered = products
    .filter((p) => {
      if (category !== "all" && p.product_type !== category) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.seller_name?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "price_asc") return (getMinPrice(a) ?? 0) - (getMinPrice(b) ?? 0);
      if (sort === "price_desc") return (getMinPrice(b) ?? 0) - (getMinPrice(a) ?? 0);
      return 0;
    });

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="border-b bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-semibold">Marketplace</h1>
              {!loading && (
                <Badge variant="secondary" className="rounded-full text-xs font-normal">
                  {filtered.length} products
                </Badge>
              )}
            </div>

            {/* Search + Sort */}
            <div className="flex items-center gap-2">
              <div className="relative hidden sm:block">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-56 pl-8 text-sm"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="price_asc">Price: Low → High</SelectItem>
                  <SelectItem value="price_desc">Price: High → Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Category tabs */}
        <div className="flex gap-1 overflow-x-auto border-b py-3 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                category === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Mobile search */}
        <div className="relative mt-3 sm:hidden">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>

        {/* Active filters */}
        {(search || category !== "all") && !loading && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? "s" : ""} for</span>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs text-foreground hover:bg-accent"
              >
                "{search}" <X className="h-3 w-3" />
              </button>
            )}
            {category !== "all" && (
              <button
                onClick={() => setCategory("all")}
                className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs text-foreground hover:bg-accent"
              >
                {CATEGORIES.find((c) => c.id === category)?.label} <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        <div className="py-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="overflow-hidden rounded-lg border bg-card">
                  <div className="h-44 animate-pulse bg-muted" />
                  <div className="p-3 space-y-2">
                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                    <div className="flex items-center justify-between pt-1">
                      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                      <div className="h-7 w-14 animate-pulse rounded-md bg-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border bg-muted">
                <ShoppingBag className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No products found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search ? "Try different keywords" : "No products in this category yet"}
              </p>
              {(search || category !== "all") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4"
                  onClick={() => { setSearch(""); setCategory("all"); }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((product) => {
                const price = getMinPrice(product);
                const gradient = PLACEHOLDER_GRADIENTS[product.id % PLACEHOLDER_GRADIENTS.length];
                const typeLabel = product.product_type
                  ? product.product_type.charAt(0).toUpperCase() + product.product_type.slice(1).toLowerCase()
                  : "Digital";

                return (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    className="group overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40 hover:shadow-sm"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-44 overflow-hidden bg-muted">
                      {product.cover_image ? (
                        <SafeImage
                          src={product.cover_image}
                          alt={product.title}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${gradient}`}>
                          <ShoppingBag className="h-8 w-8 text-white/40" />
                        </div>
                      )}
                      <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                        {typeLabel}
                      </span>
                      {price === null && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="rounded bg-white/10 px-3 py-1 text-xs font-medium text-white">Sold out</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">
                        {product.title}
                      </p>
                      {product.seller_name && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {product.seller_name}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm font-semibold">
                          {price !== null ? `₦${price.toLocaleString()}` : "—"}
                        </span>
                        <Button size="sm" className="h-7 rounded-md px-3 text-xs">
                          View
                        </Button>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <ProductsContent />
    </Suspense>
  );
}

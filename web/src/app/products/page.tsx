"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import { Input } from "@/components/ui/input";
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
  slug?: string;
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

// These ids must be real Product.product_type values, since the server now
// filters on them. The previous list used labels like "ebook" and "course"
// that match no product type, so those chips always returned nothing.
const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "pdf", label: "eBooks (PDF)" },
  { id: "docx", label: "eBooks (DOCX)" },
  { id: "mp3", label: "Audio" },
  { id: "event", label: "Events" },
];

const PAGE_SIZE = 24;

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

  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState(0);

  // Search, category and sort are all applied by the server. With paging the
  // browser only holds one page, so filtering or sorting here would only
  // affect that page — "cheapest first" would show the cheapest of page 1,
  // not of the catalogue. Debounced so typing doesn't fire a request per key.
  useEffect(() => {
    const t = setTimeout(() => { fetchProducts(1); }, 300);
    return () => clearTimeout(t);
  }, [search, category, sort]);

  const fetchProducts = async (targetPage: number) => {
    const isFirst = targetPage === 1;
    isFirst ? setLoading(true) : setLoadingMore(true);

    try {
      const q = new URLSearchParams({
        page: String(targetPage),
        page_size: String(PAGE_SIZE),
        ordering: sort,
      });
      if (search.trim()) q.set("search", search.trim());
      if (category !== "all") q.set("product_type", category);

      const res = await fetch(`/api/products?${q}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      // Tolerate an unpaginated response in case an older backend is live.
      const results: Product[] = Array.isArray(data) ? data : data.results || [];
      const meta = Array.isArray(data) ? null : data.pagination;

      setProducts((prev) => (isFirst ? results : [...prev, ...results]));
      setPage(targetPage);
      setHasNext(meta ? meta.has_next : false);
      setTotal(meta ? meta.total_items : results.length);
    } catch (e: any) {
      toast.error(e.message || "Failed to load products");
      if (isFirst) { setProducts([]); setTotal(0); setHasNext(false); }
    } finally {
      isFirst ? setLoading(false) : setLoadingMore(false);
    }
  };

  // Server already filtered and sorted; render what it returned.
  const filtered = products;

  return (
    <div className="min-h-screen bg-page">
      {/* Page header */}
      <div className="mx-auto max-w-7xl px-5 pt-12 sm:px-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-500">
          Marketplace
        </p>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-semibold leading-tight text-ink sm:text-5xl">
              Browse Products
            </h1>
            {!loading && (
              <p className="mt-2 text-gray-600">
                {filtered.length} {filtered.length === 1 ? "product" : "products"} available
              </p>
            )}
          </div>

          {/* Search + Sort */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-full border-gray-200 bg-white pl-11 pr-9 focus-visible:ring-brand-300 sm:w-64"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-11 w-40 rounded-full border-gray-200 bg-white text-sm">
                <SlidersHorizontal className="mr-1 h-3.5 w-3.5 text-brand-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="price_asc">Price: Low → High</SelectItem>
                <SelectItem value="price_desc">Price: High → Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Category chips */}
        <div className="scrollbar-hide mt-8 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`shrink-0 rounded-full border px-5 py-2 text-sm font-medium transition-colors ${
                category === cat.id
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-500"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Active filters */}
        {(search || category !== "all") && !loading && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""} for
            </span>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm text-brand-700 hover:bg-brand-100"
              >
                "{search}" <X className="h-3 w-3" />
              </button>
            )}
            {category !== "all" && (
              <button
                onClick={() => setCategory("all")}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm text-brand-700 hover:bg-brand-100"
              >
                {CATEGORIES.find((c) => c.id === category)?.label} <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-16 sm:py-14">
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="overflow-hidden rounded-3xl border border-gray-100 bg-white">
                <div className="h-48 animate-pulse bg-brand-50" />
                <div className="space-y-2 p-5">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                  <div className="flex items-center justify-between pt-1">
                    <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
                    <div className="h-8 w-16 animate-pulse rounded-full bg-gray-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <img src="/illustrations/web-search.svg" alt="" className="mb-6 h-40 w-auto" />
            <p className="text-xl font-semibold text-ink">No products found</p>
            <p className="mt-1 text-gray-600">
              {search ? "Try different keywords" : "No products in this category yet"}
            </p>
            {(search || category !== "all") && (
              <button
                onClick={() => { setSearch(""); setCategory("all"); }}
                className="mt-6 rounded-full border border-brand-500 px-6 py-2 font-medium text-brand-500 transition-colors hover:bg-brand-500 hover:text-white"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => {
              const price = getMinPrice(product);
              const typeLabel = product.product_type
                ? product.product_type.charAt(0).toUpperCase() + product.product_type.slice(1).toLowerCase()
                : "Digital";

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.slug || product.id}`}
                  className="group overflow-hidden rounded-3xl border border-gray-100 bg-white transition-shadow duration-300 hover:shadow-xl"
                >
                  {/* Thumbnail */}
                  <div className="relative h-48 overflow-hidden bg-brand-50">
                    {product.cover_image ? (
                      <SafeImage
                        src={product.cover_image}
                        alt={product.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ShoppingBag className="h-9 w-9 text-brand-300" />
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                      {typeLabel}
                    </span>
                    {price === null && (
                      <div className="absolute inset-0 flex items-center justify-center bg-ink/60">
                        <span className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white">Sold out</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <h3 className="truncate text-lg font-semibold text-gray-900 transition-colors group-hover:text-brand-500">
                      {product.title}
                    </h3>
                    {product.seller_name && (
                      <p className="mt-0.5 truncate text-sm text-gray-600">
                        {product.seller_name}
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <span className="font-semibold text-ink">
                        {price !== null ? `₦${price.toLocaleString()}` : "—"}
                      </span>
                      <span className="rounded-full border border-brand-500 px-4 py-1.5 text-sm font-medium text-brand-500 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                        View
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="mt-12 flex flex-col items-center gap-3 pb-16">
            <p className="text-sm text-gray-600">
              Showing {filtered.length} of {total} {total === 1 ? "product" : "products"}
            </p>
            {hasNext && (
              <button
                onClick={() => fetchProducts(page + 1)}
                disabled={loadingMore}
                className="rounded-full border border-brand-500 px-8 py-3 font-medium text-brand-500 transition-colors hover:bg-brand-500 hover:text-white disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more products"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center bg-page"><p className="text-gray-600">Loading...</p></div>}>
      <ProductsContent />
    </Suspense>
  );
}

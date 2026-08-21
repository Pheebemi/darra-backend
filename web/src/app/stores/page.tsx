"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Store, Search, ArrowRight } from "lucide-react";
import { RatingSummary } from "@/components/star-rating";

interface StoreItem {
  brand_name: string;
  brand_slug: string;
  about: string | null;
  product_count: number;
  average_rating?: number | null;
  review_count?: number;
}

// The store "about" is saved as HTML by the rich-text editor. On these list
// cards we only want a short plain-text preview, so strip the tags and
// collapse whitespace/entities rather than dumping raw markup on screen.
function stripHtml(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const PAGE_SIZE = 24;

export default function AllStoresPage() {
  const [filtered, setFiltered] = useState<StoreItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState(0);

  // Search runs on the server now — with paging, filtering in the browser
  // would only search the stores already loaded. Debounced so typing doesn't
  // fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { fetchStores(1, search); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchStores = async (targetPage: number, query: string) => {
    const isFirst = targetPage === 1;
    isFirst ? setLoading(true) : setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        page_size: String(PAGE_SIZE),
      });
      if (query.trim()) params.set("search", query.trim());

      const res = await fetch(`/api/stores?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      // Tolerate an unpaginated response in case an older backend is live.
      const results: StoreItem[] = Array.isArray(data) ? data : data.results || [];
      const meta = Array.isArray(data) ? null : data.pagination;

      setFiltered((prev) => (isFirst ? results : [...prev, ...results]));
      setPage(targetPage);
      setHasNext(meta ? meta.has_next : false);
      setTotal(meta ? meta.total_items : results.length);
    } catch {
      if (isFirst) { setFiltered([]); setTotal(0); setHasNext(false); }
    } finally {
      isFirst ? setLoading(false) : setLoadingMore(false);
    }
  };

  return (
    <div className="min-h-screen bg-page">
      {/* Page hero */}
      <section className="mx-auto max-w-7xl px-5 sm:px-16">
        <div className="grid grid-cols-1 items-center gap-8 py-12 sm:grid-cols-2 sm:py-16">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent-link">
              Sellers
            </p>
            <h1 className="mb-4 text-4xl font-semibold leading-tight text-ink sm:text-5xl">
              Browse Stores
            </h1>
            <p className="mb-8 max-w-[45ch] text-lg text-body">
              Discover independent creators and explore their digital products.
            </p>
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
              <Input
                placeholder="Search stores..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-12 rounded-full border-line-strong bg-surface pl-11 focus-visible:ring-brand-300"
              />
            </div>
          </div>
          <img
            src="/illustrations/business-shop.svg"
            alt="Storefront illustration"
            className="mx-auto hidden w-full max-w-md sm:block"
          />
        </div>
      </section>

      {/* Store grid */}
      <section className="bg-page-soft py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-16">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-44 w-full animate-pulse rounded-3xl border border-line bg-surface" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <img src="/illustrations/web-search.svg" alt="" className="mb-6 h-40 w-auto" />
              <p className="text-xl font-semibold text-ink">No stores found</p>
              <p className="mt-1 text-body">Try a different search term</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(store => (
                <Link key={store.brand_slug} href={`/store/${store.brand_slug}`} className="group">
                  <div className="flex h-full flex-col rounded-3xl border border-line bg-surface p-6 transition-shadow duration-300 hover:shadow-xl">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-softer">
                        <Store className="h-5 w-5 text-accent-link" />
                      </div>
                      <h2 className="line-clamp-1 text-xl font-semibold text-strong transition-colors group-hover:text-accent-link">
                        {store.brand_name}
                      </h2>
                    </div>
                    {stripHtml(store.about) && (
                      <p className="mb-4 line-clamp-2 text-sm text-body">{stripHtml(store.about)}</p>
                    )}
                    {!!store.review_count && (
                      <RatingSummary
                        average={store.average_rating ?? null}
                        count={store.review_count}
                        size="sm"
                        className="mb-3"
                      />
                    )}
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-sm font-medium text-accent-link">
                        {store.product_count} {store.product_count === 1 ? "product" : "products"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-accent-link opacity-0 transition-opacity group-hover:opacity-100">
                        Visit store <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="mt-10 flex flex-col items-center gap-3">
              <p className="text-sm text-body">
                Showing {filtered.length} of {total} {total === 1 ? "store" : "stores"}
              </p>
              {hasNext && (
                <button
                  onClick={() => fetchStores(page + 1, search)}
                  disabled={loadingMore}
                  className="rounded-full border border-brand-500 px-8 py-3 font-medium text-accent-link transition-colors hover:bg-brand-500 hover:text-white disabled:opacity-50"
                >
                  {loadingMore ? "Loading..." : "Load more stores"}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

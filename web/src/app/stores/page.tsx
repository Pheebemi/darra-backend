"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Store, Search, ArrowRight } from "lucide-react";

interface StoreItem {
  brand_name: string;
  brand_slug: string;
  about: string | null;
  product_count: number;
}

export default function AllStoresPage() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [filtered, setFiltered] = useState<StoreItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStores(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(stores.filter(s =>
      s.brand_name.toLowerCase().includes(q) || (s.about || "").toLowerCase().includes(q)
    ));
  }, [search, stores]);

  const fetchStores = async () => {
    try {
      const res = await fetch("/api/stores");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setStores(data);
      setFiltered(data);
    } catch {
      setStores([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page">
      {/* Page hero */}
      <section className="mx-auto max-w-7xl px-5 sm:px-16">
        <div className="grid grid-cols-1 items-center gap-8 py-12 sm:grid-cols-2 sm:py-16">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-500">
              Sellers
            </p>
            <h1 className="mb-4 text-4xl font-semibold leading-tight text-ink sm:text-5xl">
              Browse Stores
            </h1>
            <p className="mb-8 max-w-[45ch] text-lg text-gray-600">
              Discover independent creators and explore their digital products.
            </p>
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search stores..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-12 rounded-full border-gray-200 bg-white pl-11 focus-visible:ring-brand-300"
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
                <div key={i} className="h-44 w-full animate-pulse rounded-3xl border border-gray-100 bg-white" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <img src="/illustrations/web-search.svg" alt="" className="mb-6 h-40 w-auto" />
              <p className="text-xl font-semibold text-ink">No stores found</p>
              <p className="mt-1 text-gray-600">Try a different search term</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(store => (
                <Link key={store.brand_slug} href={`/store/${store.brand_slug}`} className="group">
                  <div className="flex h-full flex-col rounded-3xl border border-gray-100 bg-white p-6 transition-shadow duration-300 hover:shadow-xl">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100">
                        <Store className="h-5 w-5 text-brand-500" />
                      </div>
                      <h2 className="line-clamp-1 text-xl font-semibold text-gray-900 transition-colors group-hover:text-brand-500">
                        {store.brand_name}
                      </h2>
                    </div>
                    {store.about && (
                      <p className="mb-4 line-clamp-2 text-sm text-gray-600">{store.about}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-sm font-medium text-brand-500">
                        {store.product_count} {store.product_count === 1 ? "product" : "products"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-500 opacity-0 transition-opacity group-hover:opacity-100">
                        Visit store <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

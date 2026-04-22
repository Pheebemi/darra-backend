"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Store, PackageOpen, Search } from "lucide-react";

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
    setFiltered(stores.filter(s => s.brand_name.toLowerCase().includes(q) || (s.about || "").toLowerCase().includes(q)));
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
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <h1 className="mb-1 text-3xl font-bold text-foreground">Browse Stores</h1>
          <p className="text-muted-foreground">Discover sellers and explore their products</p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search stores..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-xl pl-9"
          />
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <PackageOpen className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold text-foreground">No stores found</p>
            <p className="text-sm text-muted-foreground">Try a different search term</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(store => (
              <Link key={store.brand_slug} href={`/store/${store.brand_slug}`}>
                <Card className="h-full cursor-pointer rounded-xl shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3800ff]/10">
                        <Store className="h-5 w-5 text-[#3800ff]" />
                      </div>
                      <h2 className="font-semibold text-foreground line-clamp-1">{store.brand_name}</h2>
                    </div>
                    {store.about && (
                      <p className="mb-3 text-xs text-muted-foreground line-clamp-2">{store.about}</p>
                    )}
                    <p className="text-xs font-medium text-[#3800ff]">
                      {store.product_count} {store.product_count === 1 ? "product" : "products"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

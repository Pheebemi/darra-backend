"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, Clock, PackageOpen, CheckCircle2, XCircle, Package } from "lucide-react";

interface Product {
  id: number;
  title: string;
  description: string;
  price: string;
  product_type: string;
  cover_image_url: string | null;
}

interface StoreData {
  id: number;
  full_name: string;
  brand_name: string;
  brand_slug: string;
  about: string | null;
  open_time: string | null;
  close_time: string | null;
  store_active: boolean;
  banner_url: string | null;
  products: Product[];
}

export default function PublicStorePage() {
  const params = useParams();
  const brand_slug = params?.brand_slug as string;
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => { if (brand_slug) fetchStore(); }, [brand_slug]);

  const fetchStore = async () => {
    try {
      const res = await fetch(`/api/store/${brand_slug}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) throw new Error("Failed");
      setStore(await res.json());
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: string | number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(Number(amount));

  const getImageUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api", "") || "http://localhost:8000";
    return `${base}${url}`;
  };

  if (loading) {
    return (
      <div>
        {/* Banner skeleton */}
        <Skeleton className="h-48 w-full rounded-none" />
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-8 -mt-10 flex items-end gap-4">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <div className="pb-2">
              <Skeleton className="mb-2 h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-64 w-full rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !store) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <PackageOpen className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Store not found</h1>
        <p className="text-muted-foreground">This store doesn't exist or has been removed.</p>
        <Button className="bg-[#3800ff] text-white hover:bg-[#2d00d4]" asChild>
          <Link href="/products">Browse Products</Link>
        </Button>
      </div>
    );
  }

  const initials = store.brand_name?.slice(0, 2).toUpperCase() || "ST";

  return (
    <div>
      {/* Banner */}
      <div className="relative h-48 w-full overflow-hidden bg-linear-to-br from-[#3800ff] to-[#7c3aed]">
        {store.banner_url && (
          <img
            src={getImageUrl(store.banner_url) || ""}
            alt="Store banner"
            className="h-full w-full object-cover"
          />
        )}
      </div>

      {/* Profile row */}
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4 -mt-10">
            {/* Avatar */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-[#3800ff] shadow-md">
              <span className="text-2xl font-bold text-white">{initials}</span>
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{store.brand_name}</h1>
                {store.store_active ? (
                  <Badge className="flex items-center gap-1 bg-green-100 text-green-700 text-xs">
                    <CheckCircle2 className="h-3 w-3" /> Open
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                    <XCircle className="h-3 w-3" /> Closed
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{store.full_name}</p>
            </div>
          </div>
        </div>

        {/* Info bar */}
        <div className="mb-8 flex flex-wrap items-center gap-6 border-b pb-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Package className="h-4 w-4 text-[#3800ff]" />
            <span>{store.products.length} {store.products.length === 1 ? "product" : "products"}</span>
          </div>
          {(store.open_time || store.close_time) && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-[#3800ff]" />
              <span>{store.open_time || "—"} – {store.close_time || "—"}</span>
            </div>
          )}
          {store.about && (
            <p className="w-full text-sm text-muted-foreground sm:w-auto">{store.about}</p>
          )}
        </div>

        {/* Products */}
        <h2 className="mb-4 text-base font-semibold text-foreground">All Products</h2>

        {store.products.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border bg-muted/30 py-20 text-center">
            <PackageOpen className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-foreground">No products yet</p>
            <p className="text-sm text-muted-foreground">This seller hasn't listed anything yet.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {store.products.map(product => (
              <Link key={product.id} href={`/products/${product.id}`} className="group block">
                <div className="overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md">
                  {/* Image */}
                  <div className="relative h-48 w-full overflow-hidden bg-[#e8deff]">
                    {product.cover_image_url ? (
                      <img
                        src={getImageUrl(product.cover_image_url) || ""}
                        alt={product.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Store className="h-10 w-10 text-[#3800ff]/30" />
                      </div>
                    )}
                    {/* Type badge */}
                    <div className="absolute left-3 top-3">
                      <span className="rounded-full bg-black/50 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-white">
                        {product.product_type}
                      </span>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="mb-1 font-semibold text-foreground line-clamp-1 group-hover:text-[#3800ff] transition-colors">
                      {product.title}
                    </h3>
                    <p className="mb-3 text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-[#3800ff]">{formatCurrency(product.price)}</span>
                      <span className="text-xs font-medium text-[#3800ff] opacity-0 transition-opacity group-hover:opacity-100">
                        View →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="pb-12" />
      </div>
    </div>
  );
}

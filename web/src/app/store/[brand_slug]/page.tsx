"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, Clock, CheckCircle2, XCircle, Package, ArrowRight } from "lucide-react";

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
      <div className="min-h-screen bg-page">
        {/* Banner skeleton */}
        <Skeleton className="h-56 w-full rounded-none" />
        <div className="mx-auto max-w-7xl px-5 sm:px-16">
          <div className="-mt-10 mb-8 flex items-end gap-4">
            <Skeleton className="h-20 w-20 rounded-2xl" />
            <div className="pb-2">
              <Skeleton className="mb-2 h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-64 w-full rounded-3xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !store) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-page px-5 text-center">
        <img src="/illustrations/web-search.svg" alt="" className="h-40 w-auto" />
        <h1 className="text-3xl font-semibold text-ink">Store not found</h1>
        <p className="text-gray-600">This store doesn't exist or has been removed.</p>
        <Link
          href="/products"
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  const initials = store.brand_name?.slice(0, 2).toUpperCase() || "ST";

  return (
    <div className="min-h-screen bg-page">
      {/* Banner */}
      <div className="relative h-56 w-full bg-brand-950">
        {store.banner_url ? (
          <img
            src={getImageUrl(store.banner_url) || ""}
            alt="Store banner"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-end overflow-hidden pr-16">
            <Store className="hidden h-32 w-32 text-brand-500/30 sm:block" />
          </div>
        )}
      </div>

      {/* Profile row */}
      <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-16">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="-mt-10 flex items-end gap-4">
            {/* Avatar */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-brand-500 shadow-md">
              <span className="text-2xl font-bold text-white">{initials}</span>
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-semibold text-ink">{store.brand_name}</h1>
                {store.store_active ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EBFBF0] px-3 py-1 text-xs font-medium text-[#00B42A]">
                    <CheckCircle2 className="h-3 w-3" /> Open
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                    <XCircle className="h-3 w-3" /> Closed
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{store.full_name}</p>
            </div>
          </div>
        </div>

        {/* Info bar */}
        <div className="mb-10 flex flex-wrap items-center gap-6 border-b border-brand-100 pb-6 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <Package className="h-4 w-4 text-brand-500" />
            <span>{store.products.length} {store.products.length === 1 ? "product" : "products"}</span>
          </div>
          {(store.open_time || store.close_time) && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-brand-500" />
              <span>{store.open_time || "—"} – {store.close_time || "—"}</span>
            </div>
          )}
          {store.about && (
            <div
              className="w-full text-sm text-gray-600 [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_p]:mb-1"
              dangerouslySetInnerHTML={{ __html: store.about }}
            />
          )}
        </div>

        {/* Products */}
        <h2 className="mb-6 text-3xl font-semibold text-ink">All Products</h2>

        {store.products.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-brand-200 bg-white py-16 text-center">
            <img src="/illustrations/blank-canvas.svg" alt="" className="mb-6 h-40 w-auto" />
            <p className="text-xl font-semibold text-ink">No products yet</p>
            <p className="mt-1 text-gray-600">This seller hasn't listed anything yet.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {store.products.map(product => (
              <Link key={product.id} href={`/products/${product.id}`} className="group block">
                <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white transition-shadow duration-300 hover:shadow-xl">
                  {/* Image */}
                  <div className="relative h-52 w-full overflow-hidden bg-brand-50">
                    {product.cover_image_url ? (
                      <img
                        src={getImageUrl(product.cover_image_url) || ""}
                        alt={product.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Store className="h-10 w-10 text-brand-300" />
                      </div>
                    )}
                    {/* Type badge */}
                    <div className="absolute left-3 top-3">
                      <span className="rounded-full bg-ink/70 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white backdrop-blur-sm">
                        {product.product_type}
                      </span>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-5">
                    <h3 className="mb-1 line-clamp-1 text-xl font-semibold text-gray-900 transition-colors group-hover:text-brand-500">
                      {product.title}
                    </h3>
                    <p className="mb-4 line-clamp-2 text-sm text-gray-600">{product.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">{formatCurrency(product.price)}</span>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-500 opacity-0 transition-opacity group-hover:opacity-100">
                        View <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="pb-16" />
      </div>
    </div>
  );
}

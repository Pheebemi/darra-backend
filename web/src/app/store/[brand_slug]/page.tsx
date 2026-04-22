"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Store, Clock, PackageOpen, CheckCircle2, XCircle } from "lucide-react";

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

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Skeleton className="mb-4 h-12 w-64" />
        <Skeleton className="mb-8 h-6 w-96" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-56 w-full rounded-xl" />)}
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
        <Button asChild><Link href="/tickets">Browse Products</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Store header */}
      <div className="mb-8 flex flex-col gap-4 rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#3800ff]/10">
              <Store className="h-7 w-7 text-[#3800ff]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{store.brand_name}</h1>
              <p className="text-sm text-muted-foreground">{store.full_name}</p>
            </div>
          </div>
          {store.store_active ? (
            <Badge className="flex items-center gap-1 bg-green-100 text-green-700">
              <CheckCircle2 className="h-3 w-3" /> Open
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1">
              <XCircle className="h-3 w-3" /> Closed
            </Badge>
          )}
        </div>
        {store.about && <p className="text-sm text-muted-foreground">{store.about}</p>}
        {(store.open_time || store.close_time) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Hours: {store.open_time || "—"} – {store.close_time || "—"}</span>
          </div>
        )}
      </div>

      <h2 className="mb-4 text-lg font-semibold text-foreground">Products ({store.products.length})</h2>

      {store.products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-16 text-center">
          <PackageOpen className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No products listed yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {store.products.map(product => (
            <Card key={product.id} className="overflow-hidden rounded-xl shadow-sm">
              <div className="aspect-video w-full bg-[#e8deff]">
                {product.cover_image_url ? (
                  <img src={product.cover_image_url} alt={product.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <PackageOpen className="h-10 w-10 text-[#3800ff]/40" />
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="mb-1 font-semibold text-foreground line-clamp-1">{product.title}</h3>
                <p className="mb-3 text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#3800ff]">{formatCurrency(product.price)}</span>
                  <Button size="sm" className="bg-[#3800ff] text-white hover:bg-[#2d00d4]" asChild>
                    <Link href={`/products/${product.id}`}>View</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

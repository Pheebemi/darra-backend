"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeImage } from "@/components/safe-image";
import { Library, ShoppingBag, ChevronRight, Package, Download } from "lucide-react";
import { toast } from "sonner";

interface LibraryItem {
  id: number;
  product: {
    id: number;
    title: string;
    product_type: string;
    cover_image_url?: string;
  };
  event_tickets?: Array<{ id: number }>;
}

interface Product {
  id: number;
  title: string;
  price: number;
  cover_image?: string;
  product_type: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export default function BuyerDashboard() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialized && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [libRes, prodRes] = await Promise.allSettled([
        fetch("/api/payments/library"),
        fetch("/api/products"),
      ]);

      if (libRes.status === "fulfilled" && libRes.value.ok) {
        const d = await libRes.value.json();
        setLibrary(Array.isArray(d) ? d : d.results || []);
      }
      if (prodRes.status === "fulfilled" && prodRes.value.ok) {
        const d = await prodRes.value.json();
        const items = Array.isArray(d) ? d : d.results || [];
        setFeatured(items.slice(0, 6));
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  if (!initialized || !isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  const userType = (user?.user_type || "buyer").toLowerCase();
  if (userType !== "buyer") { router.push("/dashboard/seller"); return null; }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Welcome back, {user?.full_name?.split(" ")[0] || "there"}</h1>
            <p className="text-sm text-muted-foreground">Your digital library</p>
          </div>
          <Button size="sm" asChild>
            <Link href="/products">
              <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
              Browse Products
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Card className="shadow-none">
            <CardHeader className="px-4 pt-4 pb-1">
              <span className="text-xs text-muted-foreground">Purchased</span>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? <Skeleton className="h-7 w-12" /> : (
                <p className="text-xl font-semibold">{library.length}</p>
              )}
              <p className="text-xs text-muted-foreground">products</p>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="px-4 pt-4 pb-1">
              <span className="text-xs text-muted-foreground">Library</span>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xl font-semibold">Access</p>
              <Button variant="link" className="h-auto p-0 text-xs" asChild>
                <Link href="/dashboard/buyer/library">View all →</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-none col-span-2 md:col-span-1">
            <CardHeader className="px-4 pt-4 pb-1">
              <span className="text-xs text-muted-foreground">Discover</span>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-sm text-muted-foreground mb-2">New products added daily</p>
              <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                <Link href="/products">Browse →</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent library items */}
        <Card className="shadow-none">
          <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">My Library</CardTitle>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-0.5" asChild>
              <Link href="/dashboard/buyer/library">All <ChevronRight className="h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : library.length > 0 ? (
              <div className="divide-y">
                {library.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.product.cover_image_url && (
                        <SafeImage
                          src={item.product.cover_image_url}
                          alt={item.product.title}
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.product.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{item.product.product_type}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" asChild>
                      <Link href={`/dashboard/buyer/library`}>
                        <Download className="mr-1 h-3 w-3" />Access
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Library className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm font-medium">Library is empty</p>
                <p className="text-xs text-muted-foreground">Products you purchase will appear here</p>
                <Button size="sm" className="mt-4 h-8 text-xs" asChild>
                  <Link href="/products">
                    <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />Browse Products
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Featured products */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Featured Products</h2>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-0.5" asChild>
              <Link href="/products">All <ChevronRight className="h-3 w-3" /></Link>
            </Button>
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
            </div>
          ) : featured.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="group overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40"
                >
                  <div className="relative h-32 w-full bg-muted">
                    {p.cover_image ? (
                      <SafeImage src={p.cover_image} alt={p.title} fill className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="mt-0.5 text-xs text-primary font-medium">{fmt(p.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No products available yet.</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

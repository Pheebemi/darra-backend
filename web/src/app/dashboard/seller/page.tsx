"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeImage } from "@/components/safe-image";
import {
  Package,
  TrendingUp,
  DollarSign,
  Users,
  Plus,
  ShoppingCart,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Clock,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface AnalyticsData {
  total_revenue: number;
  total_orders: number;
  total_customers: number;
  total_products: number;
  revenue_growth: number;
  orders_growth: number;
  customers_growth: number;
  products_growth: number;
  avg_order_value: number;
  conversion_rate: number;
  top_products: Array<{ name: string; sales: number; revenue: number; growth: number }>;
  daily_revenue: Array<{ date: string; revenue: number }>;
}

interface EarningsData {
  total_sales: number;
  total_commission: number;
  total_payouts: number;
  available_balance: number;
}

interface SellerOrder {
  id: number;
  product: { id: number; title: string; price: number; cover_image?: string };
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
}

interface Product {
  id: number;
  title: string;
  price: number;
  cover_image?: string;
}

const fmt = (n: number | undefined | null) => {
  if (!n || isNaN(n)) return "₦0";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
};

const fmtNum = (n: number | undefined | null) => {
  if (!n || isNaN(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function SellerDashboard() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [recentOrders, setRecentOrders] = useState<SellerOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");

  useEffect(() => {
    if (initialized && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated, timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, earningsRes, ordersRes, productsRes] = await Promise.allSettled([
        fetch(`/api/seller/analytics?timeRange=${timeRange}`),
        fetch("/api/seller/earnings"),
        fetch("/api/seller/orders"),
        fetch("/api/seller/events"),
      ]);

      if (analyticsRes.status === "fulfilled" && analyticsRes.value.ok)
        setAnalytics(await analyticsRes.value.json());
      if (earningsRes.status === "fulfilled" && earningsRes.value.ok)
        setEarnings(await earningsRes.value.json());
      if (ordersRes.status === "fulfilled" && ordersRes.value.ok) {
        const d = await ordersRes.value.json();
        setRecentOrders(Array.isArray(d) ? d.slice(0, 5) : []);
      }
      if (productsRes.status === "fulfilled" && productsRes.value.ok) {
        const d = await productsRes.value.json();
        setProducts(Array.isArray(d) ? d : []);
      }
    } catch {
      toast.error("Failed to load dashboard data");
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
  if (userType !== "seller") { router.push("/dashboard/buyer"); return null; }

  const statCards = [
    {
      label: "Total Revenue",
      value: fmt(analytics?.total_revenue),
      growth: analytics?.revenue_growth,
      icon: DollarSign,
    },
    {
      label: "Orders",
      value: fmtNum(analytics?.total_orders),
      growth: analytics?.orders_growth,
      icon: ShoppingCart,
    },
    {
      label: "Customers",
      value: fmtNum(analytics?.total_customers),
      growth: analytics?.customers_growth,
      icon: Users,
    },
    {
      label: "Products",
      value: fmtNum(analytics?.total_products),
      growth: analytics?.products_growth,
      icon: Package,
    },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-8 p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent-link">Overview</p>
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
              {user?.brand_name || user?.full_name || "Your Store"}
            </h1>
          </div>
          <Button asChild>
            <Link href="/dashboard/seller/create-event">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Product
            </Link>
          </Button>
        </div>

        {/* Time range */}
        <div className="flex w-fit gap-1 rounded-full border border-line-strong bg-surface p-1">
          {(["7d", "30d", "90d", "1y"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                timeRange === r
                  ? "bg-brand-500 text-white"
                  : "text-body hover:text-accent-link"
              }`}
            >
              {r === "7d" ? "7 days" : r === "30d" ? "30 days" : r === "90d" ? "90 days" : "1 year"}
            </button>
          ))}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map(({ label, value, growth, icon: Icon }) => (
            <Card key={label} className="shadow-none">
              <CardHeader className="flex flex-row items-center justify-between px-5 pb-1 pt-5">
                <span className="text-xs text-body">{label}</span>
                <span className="rounded-lg bg-brand-softer p-2">
                  <Icon className="h-3.5 w-3.5 text-accent-link" />
                </span>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {loading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <>
                    <p className="text-2xl font-semibold text-ink">{value}</p>
                    {growth !== undefined && (
                      <p className={`mt-0.5 flex items-center gap-0.5 text-xs ${growth >= 0 ? "text-ok" : "text-err"}`}>
                        {growth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {growth > 0 ? "+" : ""}{growth}%
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Earnings summary */}
        {(earnings || loading) && (
          <div className="rounded-3xl bg-brand-950 p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Earnings</h2>
              <Link
                href="/dashboard/seller/earnings"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-200 transition-colors hover:text-white"
              >
                View details <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              {[
                { label: "Gross sales", value: fmt(earnings?.total_sales), color: "text-white" },
                { label: "Platform fee", value: fmt(earnings?.total_commission), color: "text-brand-200" },
                { label: "Available", value: fmt(earnings?.available_balance), color: "text-brand-300" },
                { label: "Withdrawn", value: fmt(earnings?.total_payouts), color: "text-brand-200" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs text-brand-200/70">{label}</p>
                  {loading ? (
                    <Skeleton className="mt-1 h-5 w-20 bg-white/10" />
                  ) : (
                    <p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard/seller/earnings/request-payout"
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />Request Payout
              </Link>
              <Link
                href="/dashboard/seller/earnings/payout-history"
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-300/40 px-6 py-2.5 text-sm font-medium text-brand-100 transition-colors hover:bg-white/10"
              >
                <BarChart3 className="h-3.5 w-3.5" />Payout history
              </Link>
            </div>
          </div>
        )}

        {/* Recent orders + top products */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Recent orders */}
          <Card className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between px-5 pb-3 pt-5">
              <CardTitle className="text-base font-semibold text-ink">Recent Orders</CardTitle>
              <Button size="sm" variant="ghost" className="h-7 gap-0.5 text-xs" asChild>
                <Link href="/dashboard/seller/orders">All <ChevronRight className="h-3 w-3" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : recentOrders.length > 0 ? (
                <div className="divide-y">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{order.product.title}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(order.created_at)}</p>
                      </div>
                      <div className="ml-3 text-right shrink-0">
                        <p className="text-sm font-medium">{fmt(order.total_price)}</p>
                        <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <ShoppingCart className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-xs text-muted-foreground">No orders yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top products */}
          <Card className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between px-5 pb-3 pt-5">
              <CardTitle className="text-base font-semibold text-ink">Top Products</CardTitle>
              <Button size="sm" variant="ghost" className="h-7 gap-0.5 text-xs" asChild>
                <Link href="/dashboard/seller/inventory">All <ChevronRight className="h-3 w-3" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : analytics?.top_products && analytics.top_products.length > 0 ? (
                <div className="divide-y">
                  {analytics.top_products.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-softer text-[10px] font-medium text-brand-700">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{fmtNum(p.sales)} sales · {fmt(p.revenue)}</p>
                      </div>
                      {p.growth !== undefined && (
                        <span className={`text-xs font-medium ${p.growth >= 0 ? "text-ok" : "text-err"}`}>
                          {p.growth > 0 ? "+" : ""}{p.growth}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : products.length > 0 ? (
                <div className="divide-y">
                  {products.slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-muted">
                        {p.cover_image && (
                          <SafeImage src={p.cover_image} alt={p.title} width={32} height={32} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{fmt(p.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Package className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-xs text-muted-foreground">No products yet</p>
                  <Button size="sm" variant="outline" className="mt-3 h-7 text-xs" asChild>
                    <Link href="/dashboard/seller/create-event">
                      <Plus className="mr-1 h-3 w-3" />Add product
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

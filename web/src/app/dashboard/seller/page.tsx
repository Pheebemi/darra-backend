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
  ShoppingBag,
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
  top_products: Array<{
    name: string;
    sales: number;
    revenue: number;
    growth: number;
  }>;
  daily_revenue: Array<{
    date: string;
    revenue: number;
  }>;
}

interface EarningsData {
  total_sales: number;
  total_commission: number;
  total_payouts: number;
  available_balance: number;
}

interface SellerOrder {
  id: number;
  product: {
    id: number;
    title: string;
    price: number;
    cover_image?: string;
  };
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
}

interface Event {
  id: number;
  title: string;
  description: string;
  price: number;
  cover_image?: string;
  event_date?: string;
  is_ticket_event?: boolean;
}

export default function SellerDashboard() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [recentOrders, setRecentOrders] = useState<SellerOrder[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("7d");

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated, timeRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch analytics
      const analyticsRes = await fetch(
        `/api/seller/analytics?timeRange=${timeRange}`
      );
      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      }

      // Fetch earnings
      const earningsRes = await fetch("/api/seller/earnings");
      if (earningsRes.ok) {
        const earningsData = await earningsRes.json();
        setEarnings(earningsData);
      }

      // Fetch recent orders
      const ordersRes = await fetch("/api/seller/orders");
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setRecentOrders(Array.isArray(ordersData) ? ordersData.slice(0, 5) : []);
      }

      // Fetch events
      const eventsRes = await fetch("/api/seller/events");
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(Array.isArray(eventsData) ? eventsData : []);
      }
    } catch (error: any) {
      console.error("Failed to fetch dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (!amount || isNaN(amount)) return "₦0";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number | undefined | null) => {
    if (!num || isNaN(num)) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!initialized || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-foreground/70">Loading...</p>
      </div>
    );
  }

  const userType = (user?.user_type || "buyer").toLowerCase();
  if (userType !== "seller") {
    router.push("/dashboard/buyer");
    return null;
  }

  const timeRanges = [
    { key: "7d", label: "7D" },
    { key: "30d", label: "30D" },
    { key: "90d", label: "90D" },
    { key: "1y", label: "1Y" },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {user?.brand_name || user?.full_name || "Seller"}!
          </h1>
          <p className="mt-2 text-foreground/70">
            Track your store performance and manage your events
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="mb-6 flex gap-2 rounded-lg bg-card p-1">
          {timeRanges.map((range) => (
            <Button
              key={range.key}
              variant={timeRange === range.key ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeRange(range.key)}
              className="flex-1"
            >
              {range.label}
            </Button>
          ))}
        </div>

        {/* Key Metrics */}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-purple-600 to-indigo-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/90">
                Total Revenue
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-white/80" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32 bg-white/20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(analytics?.total_revenue)}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-white/80">
                    {analytics?.revenue_growth && analytics.revenue_growth > 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    <span>
                      {analytics?.revenue_growth
                        ? `${analytics.revenue_growth > 0 ? "+" : ""}${analytics.revenue_growth}%`
                        : "0%"}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-pink-500 to-rose-500 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/90">
                Total Orders
              </CardTitle>
              <ShoppingBag className="h-4 w-4 text-white/80" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32 bg-white/20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatNumber(analytics?.total_orders)}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-white/80">
                    {analytics?.orders_growth && analytics.orders_growth > 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    <span>
                      {analytics?.orders_growth
                        ? `${analytics.orders_growth > 0 ? "+" : ""}${analytics.orders_growth}%`
                        : "0%"}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/90">
                Customers
              </CardTitle>
              <Users className="h-4 w-4 text-white/80" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32 bg-white/20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatNumber(analytics?.total_customers)}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-white/80">
                    {analytics?.customers_growth && analytics.customers_growth > 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    <span>
                      {analytics?.customers_growth
                        ? `${analytics.customers_growth > 0 ? "+" : ""}${analytics.customers_growth}%`
                        : "0%"}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/90">
                Products
              </CardTitle>
              <Package className="h-4 w-4 text-white/80" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-32 bg-white/20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatNumber(analytics?.total_products)}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-white/80">
                    {analytics?.products_growth && analytics.products_growth > 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    <span>
                      {analytics?.products_growth
                        ? `${analytics.products_growth > 0 ? "+" : ""}${analytics.products_growth}%`
                        : "0%"}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Earnings & Payouts */}
        {earnings && (
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Earnings & Payouts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Total Sales</span>
                    </div>
                    <div className="text-xl font-bold">
                      {formatCurrency(earnings.total_sales)}
                    </div>
                    <p className="text-xs text-muted-foreground">Gross revenue</p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <ArrowDownRight className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">Platform Fee</span>
                    </div>
                    <div className="text-xl font-bold">
                      {formatCurrency(earnings.total_commission)}
                    </div>
                    <p className="text-xs text-muted-foreground">4% commission</p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Net Earnings</span>
                    </div>
                    <div className="text-xl font-bold">
                      {formatCurrency(earnings.available_balance)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Available for withdrawal
                    </p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium">Total Payouts</span>
                    </div>
                    <div className="text-xl font-bold">
                      {formatCurrency(earnings.total_payouts)}
                    </div>
                    <p className="text-xs text-muted-foreground">Already withdrawn</p>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <Button asChild className="flex-1">
                    <Link href="/dashboard/seller/payouts/request">
                      <ArrowUpRight className="mr-2 h-4 w-4" />
                      Request Payout
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href="/dashboard/seller/payouts/history">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Payout History
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Orders */}
        <div className="mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Orders</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/seller/orders">
                  View All
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : recentOrders.length > 0 ? (
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-4">
                        {order.product.cover_image && (
                          <div className="relative h-12 w-12 overflow-hidden rounded-lg">
                            <SafeImage
                              src={order.product.cover_image}
                              alt={order.product.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{order.product.title}</p>
                          <p className="text-sm text-muted-foreground">
                            Qty: {order.quantity} • {formatDate(order.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(order.total_price)}</p>
                        <Badge variant="outline" className="mt-1">
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No orders yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Orders will appear here once customers start buying
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Performing Products */}
        {analytics?.top_products && analytics.top_products.length > 0 && (
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.top_products.map((product, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatNumber(product.sales)} orders •{" "}
                            {formatCurrency(product.revenue)}
                          </p>
                        </div>
                      </div>
                      {product.growth !== undefined && (
                        <Badge
                          variant={product.growth > 0 ? "default" : "secondary"}
                        >
                          {product.growth > 0 ? "+" : ""}
                          {product.growth}%
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Manage Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild className="w-full">
                <Link href="/dashboard/seller/create-event">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Event
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/seller/inventory">
                  <Package className="mr-2 h-4 w-4" />
                  View Inventory
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Orders & Analytics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/seller/orders">
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  View Orders
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/seller">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Analytics
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Your Events */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your Events</h2>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/seller/inventory">
                View All Products
              </Link>
            </Button>
          </div>

          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <Skeleton className="h-40 w-full" />
                  <CardHeader>
                    <Skeleton className="h-4 w-3/4" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : events.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <Card key={event.id} className="overflow-hidden">
                  <div className="relative h-40 w-full">
                    {event.cover_image ? (
                      <SafeImage
                        src={event.cover_image}
                        alt={event.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-700" />
                    )}
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base line-clamp-1">
                      {event.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <span className="text-sm text-foreground/70">
                      From {formatCurrency(event.price)}
                    </span>
                    <Button size="sm" asChild>
                      <Link href={`/dashboard/seller/events/${event.id}`}>
                        Manage
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden">
              <div className="h-40 w-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-700" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base">No events yet</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-foreground/70">
                  Create your first event to start selling tickets
                </p>
                <Button asChild size="sm" className="w-full">
                  <Link href="/dashboard/seller/create-event">Create Event</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

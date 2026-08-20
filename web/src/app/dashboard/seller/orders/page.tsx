"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/safe-image";
import {
  ArrowLeft,
  Package,
  RefreshCw,
  ChevronDown,
  Receipt,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

interface SellerOrder {
  id: number;
  product: {
    id: number;
    title: string;
    price: number;
    product_type?: string;
    cover_image?: string;
  };
  quantity: number;
  total_price: number;
  unit_price?: number;
  status: string;
  payment_status?: string;
  payment_reference?: string;
  created_at: string;
  customer?: {
    name: string;
    email: string;
  };
}

export default function OrdersPage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    }
  }, [isAuthenticated]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/seller/orders");
      if (response.ok) {
        const data = await response.json();
        setOrders(Array.isArray(data) ? data : []);
      } else {
        toast.error("Failed to fetch orders");
      }
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusPill = (status: string) => {
    const s = status?.toLowerCase() || "";
    if (s.includes("success") || s.includes("completed"))
      return "bg-ok-soft text-ok";
    if (s.includes("pending"))
      return "bg-warn-soft text-warn";
    if (s.includes("failed") || s.includes("cancelled"))
      return "bg-err-soft text-err";
    return "bg-brand-soft text-accent-link";
  };

  if (!initialized || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page">
        <p className="text-body">Loading...</p>
      </div>
    );
  }

  const userType = (user?.user_type || "buyer").toLowerCase();
  if (userType !== "seller") {
    router.push("/dashboard/buyer");
    return null;
  }

  const totalRevenue = orders.reduce((s, o) => s + (o.total_price || 0), 0);
  const completedCount = orders.filter((o) => {
    const s = (o.payment_status || o.status || "").toLowerCase();
    return s.includes("success") || s.includes("completed");
  }).length;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-8 p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent-link">Sales</p>
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Orders</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/seller">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total orders", value: loading ? null : orders.length.toString() },
            { label: "Completed", value: loading ? null : completedCount.toString() },
            { label: "Revenue", value: loading ? null : formatCurrency(totalRevenue) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-3xl border border-line bg-surface p-5">
              <p className="text-xs text-body">{label}</p>
              {value === null ? (
                <Skeleton className="mt-1 h-7 w-16" />
              ) : (
                <p className="mt-1 truncate text-2xl font-semibold text-ink">{value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-3xl" />
            ))}
          </div>
        ) : orders.length > 0 ? (
          <div className="space-y-3">
            {orders.map((order) => {
              const isOpen = expanded === order.id;
              return (
                <div key={order.id} className="overflow-hidden rounded-3xl border border-line bg-surface">
                  {/* Row */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : order.id)}
                    className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-brand-soft/40 sm:p-5"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-brand-soft">
                      {order.product.cover_image ? (
                        <SafeImage
                          src={order.product.cover_image}
                          alt={order.product.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-5 w-5 text-brand-300" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-strong">{order.product.title}</p>
                      <p className="truncate text-xs text-subtle">
                        {order.customer?.name || "Customer"} · Qty {order.quantity} · {formatDate(order.created_at)}
                      </p>
                    </div>

                    <span className={`hidden shrink-0 rounded-full px-3 py-1 text-xs font-medium sm:inline-block ${statusPill(order.payment_status || order.status)}`}>
                      {(order.payment_status || order.status || "pending").toUpperCase()}
                    </span>

                    <span className="shrink-0 font-semibold text-ink">{formatCurrency(order.total_price)}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-faint transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {/* Expanded details */}
                  {isOpen && (
                    <div className="grid gap-3 border-t border-line bg-page-soft px-5 py-4 sm:grid-cols-2">
                      <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium sm:hidden ${statusPill(order.payment_status || order.status)}`}>
                        {(order.payment_status || order.status || "pending").toUpperCase()}
                      </span>
                      {order.customer && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 shrink-0 text-accent-link" />
                          <span className="truncate text-body">{order.customer.email}</span>
                        </div>
                      )}
                      {order.unit_price !== undefined && order.unit_price !== null && (
                        <div className="text-sm text-body">
                          Unit price: <span className="font-medium text-ink">{formatCurrency(order.unit_price)}</span>
                        </div>
                      )}
                      <div className="text-sm capitalize text-body">
                        Type: <span className="font-medium text-ink">{order.product.product_type || "Product"}</span>
                      </div>
                      {order.payment_reference && (
                        <div className="flex items-center gap-2 text-sm sm:col-span-2">
                          <Receipt className="h-4 w-4 shrink-0 text-accent-link" />
                          <span className="truncate font-mono text-xs text-body">{order.payment_reference}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-brand-200 bg-surface py-16 text-center">
            <img src="/illustrations/no-data.svg" alt="" className="mb-6 h-32 w-auto" />
            <h2 className="mb-1 text-xl font-semibold text-ink">No orders yet</h2>
            <p className="mb-6 text-sm text-body">
              Orders will appear here once customers start buying your products
            </p>
            <Button asChild>
              <Link href="/dashboard/seller/create-event">Add your first product</Link>
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

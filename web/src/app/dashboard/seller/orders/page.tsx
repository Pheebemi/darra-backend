"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SafeImage } from "@/components/safe-image";
import {
  ArrowLeft,
  ShoppingBag,
  User,
  Mail,
  ShoppingCart,
  Tag,
  DollarSign,
  Clock,
  Receipt,
  RefreshCw,
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
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    if (statusLower.includes("success") || statusLower.includes("completed")) {
      return "bg-green-500";
    }
    if (statusLower.includes("pending")) {
      return "bg-yellow-500";
    }
    if (statusLower.includes("failed") || statusLower.includes("cancelled")) {
      return "bg-red-500";
    }
    return "bg-blue-500";
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

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/seller">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">All Orders</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                View and manage all your orders
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Orders Count */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="text-center">
              <p className="text-lg font-semibold">
                {orders.length} {orders.length === 1 ? "Order" : "Orders"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="mb-4 h-6 w-3/4" />
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardContent className="p-6">
                  {/* Order Header */}
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-3">
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
                          <h3 className="text-lg font-bold">
                            {order.product.title}
                          </h3>
                          <p className="text-sm text-muted-foreground capitalize">
                            {order.product.product_type || "Product"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Badge
                      className={getStatusColor(
                        order.payment_status || order.status
                      )}
                    >
                      {(order.payment_status || order.status || "pending")
                        .toUpperCase()}
                    </Badge>
                  </div>

                  {/* Order Details */}
                  <div className="space-y-3 border-t pt-4">
                    {order.customer && (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">
                              Customer
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            {order.customer.name}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">
                              Email
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            {order.customer.email}
                          </span>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">
                          Quantity
                        </span>
                      </div>
                      <span className="text-sm font-medium">{order.quantity}</span>
                    </div>

                    {order.unit_price && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">
                            Unit Price
                          </span>
                        </div>
                        <span className="text-sm font-medium">
                          {formatCurrency(order.unit_price)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t pt-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">Total Price</span>
                      </div>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(order.total_price)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">
                          Order Date
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        {formatDate(order.created_at)}
                      </span>
                    </div>

                    {order.payment_reference && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">
                            Payment Reference
                          </span>
                        </div>
                        <span className="text-sm font-mono font-medium">
                          {order.payment_reference}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ShoppingBag className="mb-4 h-16 w-16 text-muted-foreground" />
              <h2 className="mb-2 text-xl font-semibold">No Orders Yet</h2>
              <p className="mb-6 text-center text-muted-foreground">
                Orders will appear here once customers start buying your products
              </p>
              <Button asChild>
                <Link href="/dashboard/seller/create-event">
                  Create Your First Event
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}



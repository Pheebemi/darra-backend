"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Clock,
  Hourglass,
  XCircle,
  Building2,
  CreditCard,
  User,
  Calendar,
  CheckCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface PayoutTransaction {
  id: string;
  amount: number | string;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: "pending" | "processing" | "completed" | "failed";
  transfer_reference: string;
  created_at: string;
  processed_at?: string;
}

export default function PayoutHistoryPage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const [payouts, setPayouts] = useState<PayoutTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPayoutHistory();
    }
  }, [isAuthenticated]);

  const fetchPayoutHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/seller/payouts");
      if (!response.ok) {
        throw new Error("Failed to fetch payout history");
      }
      const data = await response.json();
      setPayouts(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error("Error fetching payout history:", error);
      toast.error("Failed to load payout history");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPayoutHistory();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === "string" ? parseFloat(amount) || 0 : amount;
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "processing":
        return "bg-amber-500";
      case "pending":
        return "bg-blue-500";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return CheckCircle2;
      case "processing":
        return Clock;
      case "pending":
        return Hourglass;
      case "failed":
        return XCircle;
      default:
        return AlertCircle;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Completed";
      case "processing":
        return "Processing";
      case "pending":
        return "Pending";
      case "failed":
        return "Failed";
      default:
        return "Unknown";
    }
  };

  const calculateTotalAmount = (payouts: PayoutTransaction[]) => {
    return payouts
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => {
        const amount = typeof p.amount === "string" ? parseFloat(p.amount) || 0 : p.amount;
        return sum + amount;
      }, 0);
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Skeleton className="mb-6 h-10 w-48" />
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/seller/earnings">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Payout History</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                View all your payout requests and their status
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Header Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{payouts.length}</p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">Total Payouts</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(calculateTotalAmount(payouts))}
                </p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">Total Amount</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {payouts.filter((p) => p.status === "completed").length}
                </p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payouts List */}
        {payouts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CreditCard className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">No payouts yet</h3>
              <p className="mb-6 text-center text-sm text-muted-foreground">
                Your payout history will appear here once you make your first request
              </p>
              <Button asChild>
                <Link href="/dashboard/seller/earnings/request-payout">Request Payout</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {payouts.map((payout) => {
              const StatusIcon = getStatusIcon(payout.status);
              return (
                <Card key={payout.id}>
                  <CardContent className="p-6">
                    {/* Header */}
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-2xl font-bold text-foreground">
                          {formatCurrency(payout.amount)}
                        </p>
                        <p className="mt-1 text-xs font-mono text-muted-foreground">
                          Ref: {payout.transfer_reference}
                        </p>
                      </div>
                      <Badge className={getStatusColor(payout.status)}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {getStatusText(payout.status)}
                      </Badge>
                    </div>

                    {/* Details */}
                    <div className="space-y-3 border-t pt-4">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">Bank:</span>
                        <span className="text-sm font-semibold text-foreground">
                          {payout.bank_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">Account:</span>
                        <span className="text-sm font-semibold text-foreground">
                          {payout.account_number}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">
                          Recipient:
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {payout.account_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">
                          Requested:
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {formatDate(payout.created_at)}
                        </span>
                      </div>
                      {payout.processed_at && (
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">
                            Processed:
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {formatDate(payout.processed_at)}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}



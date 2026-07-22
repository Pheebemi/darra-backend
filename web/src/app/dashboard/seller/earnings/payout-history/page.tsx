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
        return "bg-[#EBFBF0] text-[#00B42A]";
      case "processing":
        return "bg-[#FFF9E5] text-[#B08600]";
      case "pending":
        return "bg-brand-50 text-brand-600";
      case "failed":
        return "bg-red-50 text-[#b3261e]";
      default:
        return "bg-gray-100 text-gray-500";
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-500">Finance</p>
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Payout History</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/seller/earnings">
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

        {/* Header Stats */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          {[
            { label: "Total Payouts", value: payouts.length.toString() },
            { label: "Total Amount", value: formatCurrency(calculateTotalAmount(payouts)) },
            { label: "Completed", value: payouts.filter((p) => p.status === "completed").length.toString() },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-3xl border border-gray-100 bg-white p-5 text-center">
              <p className="truncate text-2xl font-semibold text-ink">{value}</p>
              <p className="mt-1 text-xs font-medium text-gray-600 sm:text-sm">{label}</p>
            </div>
          ))}
        </div>

        {/* Payouts List */}
        {payouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-brand-200 bg-white py-16 text-center">
            <img src="/illustrations/no-data.svg" alt="" className="mb-6 h-28 w-auto" />
            <h3 className="mb-1 text-lg font-semibold text-ink">No payouts yet</h3>
            <p className="mb-6 text-sm text-gray-600">
              Your payout history will appear here once you make your first request
            </p>
            <Button asChild>
              <Link href="/dashboard/seller/earnings/request-payout">Request Payout</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {payouts.map((payout) => {
              const StatusIcon = getStatusIcon(payout.status);
              return (
                <div key={payout.id} className="rounded-3xl border border-gray-100 bg-white p-6">
                  {/* Header */}
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-2xl font-bold text-ink">
                        {formatCurrency(payout.amount)}
                      </p>
                      <p className="mt-1 font-mono text-xs text-gray-500">
                        Ref: {payout.transfer_reference}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(payout.status)}`}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {getStatusText(payout.status)}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="grid gap-x-8 gap-y-2 border-t border-gray-100 pt-4 sm:grid-cols-2">
                    {[
                      { icon: Building2, k: "Bank", v: payout.bank_name },
                      { icon: CreditCard, k: "Account", v: payout.account_number },
                      { icon: User, k: "Recipient", v: payout.account_name },
                      { icon: Calendar, k: "Requested", v: formatDate(payout.created_at) },
                      ...(payout.processed_at
                        ? [{ icon: CheckCircle, k: "Processed", v: formatDate(payout.processed_at) }]
                        : []),
                    ].map(({ icon: Icon, k, v }) => (
                      <div key={k} className="flex items-center gap-2 text-sm">
                        <Icon className="h-4 w-4 shrink-0 text-brand-500" />
                        <span className="text-gray-600">{k}:</span>
                        <span className="truncate font-medium text-ink">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}



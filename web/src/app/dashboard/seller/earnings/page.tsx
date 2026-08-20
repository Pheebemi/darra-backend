"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpCircle,
  List,
  Info,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface EarningsData {
  total_sales: number;
  total_commission: number;
  total_payouts: number;
  available_balance: number;
  last_updated: string;
}

export default function EarningsPage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchEarnings();
    }
  }, [isAuthenticated]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/seller/earnings");
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `Failed to fetch earnings (${response.status})`;
        console.error("Earnings fetch error:", {
          status: response.status,
          statusText: response.statusText,
          errorData,
        });
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Validate the data structure
      if (!data || typeof data !== 'object') {
        throw new Error("Invalid earnings data received");
      }
      
      // Ensure all required fields exist with defaults
      // Convert Decimal values (which may come as strings) to numbers
      const parseDecimal = (value: any): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };
      
      const earningsData: EarningsData = {
        total_sales: parseDecimal(data.total_sales),
        total_commission: parseDecimal(data.total_commission),
        total_payouts: parseDecimal(data.total_payouts),
        available_balance: parseDecimal(data.available_balance),
        last_updated: data.last_updated || new Date().toISOString(),
      };
      
      setEarnings(earningsData);
    } catch (error: any) {
      console.error("Error fetching earnings:", error);
      const errorMessage = error.message || "Failed to load earnings";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null) return "₦0";
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
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Earnings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View your earnings and payout information
            </p>
          </div>

          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!earnings) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Earnings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View your earnings and payout information
            </p>
          </div>

          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">Failed to load earnings</h3>
              <p className="mb-6 text-sm text-muted-foreground">
                There was an error loading your earnings data
              </p>
              <Button onClick={fetchEarnings}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-8 p-6 sm:p-8">
        {/* Header */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent-link">Finance</p>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Earnings</h1>
        </div>

        {/* Dark hero panel */}
        <div className="rounded-3xl bg-brand-950 p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 inline-flex rounded-2xl bg-brand-500/20 p-3">
                <Wallet className="h-6 w-6 text-brand-300" />
              </div>
              <p className="text-sm text-brand-200/70">Total earnings from all sales</p>
              <p className="mt-1 text-4xl font-bold text-white">
                {formatCurrency(earnings.total_sales)}
              </p>
              <p className="mt-2 text-sm text-brand-200">
                Available to withdraw:{" "}
                <span className="font-semibold text-brand-300">
                  {formatCurrency(earnings.available_balance)}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/seller/earnings/request-payout"
                className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-600"
              >
                <ArrowUpCircle className="h-4 w-4" />
                Request Payout
              </Link>
              <Link
                href="/dashboard/seller/earnings/payout-history"
                className="inline-flex items-center gap-2 rounded-full border border-brand-300/40 px-6 py-3 text-sm font-medium text-brand-100 transition-colors hover:bg-white/10"
              >
                <List className="h-4 w-4" />
                Payout History
              </Link>
            </div>
          </div>
        </div>

        {/* Earnings Breakdown */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-ink">Breakdown</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Total Sales", value: earnings.total_sales, icon: TrendingUp, chip: "bg-ok-soft", iconColor: "text-ok" },
              { label: "Platform Fee (4%)", value: earnings.total_commission, icon: TrendingDown, chip: "bg-err-soft", iconColor: "text-err" },
              { label: "Total Payouts", value: earnings.total_payouts, icon: Wallet, chip: "bg-brand-softer", iconColor: "text-accent-link" },
              { label: "Available Balance", value: earnings.available_balance, icon: Wallet, chip: "bg-warn-soft", iconColor: "text-warn" },
            ].map(({ label, value, icon: Icon, chip, iconColor }) => (
              <div key={label} className="rounded-3xl border border-line bg-surface p-5">
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${chip}`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                <p className="truncate text-xl font-bold text-ink sm:text-2xl">
                  {formatCurrency(value)}
                </p>
                <p className="mt-1 text-xs font-medium text-body sm:text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Commission Structure */}
        <div className="rounded-3xl bg-brand-soft p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-accent-link" />
            <h3 className="text-lg font-semibold text-ink">How commissions work</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { k: "Platform Fee", v: "4% of sale price" },
              { k: "Your Earnings", v: "96% of sale price" },
              { k: "Example", v: "₦1,500 sale → You earn ₦1,440" },
            ].map(({ k, v }) => (
              <div key={k} className="rounded-2xl bg-surface p-4">
                <p className="text-xs font-medium text-body">{k}</p>
                <p className="mt-1 text-sm font-semibold text-ink">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Last Updated */}
        <p className="text-center text-xs text-subtle">
          Last updated: {formatDate(earnings.last_updated)}
        </p>
      </div>
    </DashboardLayout>
  );
}


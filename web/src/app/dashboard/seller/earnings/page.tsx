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
            <h1 className="text-3xl font-bold text-foreground">Earnings</h1>
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
            <h1 className="text-3xl font-bold text-foreground">Earnings</h1>
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
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Earnings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View your earnings and payout information
          </p>
        </div>

        {/* Total Earnings Header Card */}
        <Card className="mb-6 overflow-hidden border-0 bg-gradient-to-br from-indigo-600 to-purple-600 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white/80">Total Earnings</p>
                <p className="text-3xl font-bold text-white">
                  {formatCurrency(earnings.total_sales)}
                </p>
                <p className="text-sm text-white/70">From all sales</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Button
            variant="outline"
            size="lg"
            className="h-auto flex-col items-center justify-center gap-2 py-6"
            asChild
          >
            <Link href="/dashboard/seller/earnings/request-payout">
              <ArrowUpCircle className="h-6 w-6 text-primary" />
              <span className="font-semibold">Request Payout</span>
            </Link>
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="h-auto flex-col items-center justify-center gap-2 py-6"
            asChild
          >
            <Link href="/dashboard/seller/earnings/payout-history">
              <List className="h-6 w-6 text-primary" />
              <span className="font-semibold">Payout History</span>
            </Link>
          </Button>
        </div>

        {/* Earnings Breakdown */}
        <div className="mb-6">
          <h2 className="mb-4 text-xl font-bold text-foreground">Earnings Breakdown</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Total Sales */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(earnings.total_sales)}
                </p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  Total Sales
                </p>
              </CardContent>
            </Card>

            {/* Platform Fee */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(earnings.total_commission)}
                </p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  Platform Fee (4%)
                </p>
              </CardContent>
            </Card>

            {/* Total Payouts */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                  <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(earnings.total_payouts)}
                </p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  Total Payouts
                </p>
              </CardContent>
            </Card>

            {/* Available Balance */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
                  <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(earnings.available_balance)}
                </p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  Available Balance
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Commission Structure */}
        <div className="mb-6">
          <h2 className="mb-4 text-xl font-bold text-foreground">Commission Structure</h2>
          <Card>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">How it works</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Platform Fee:
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    4% of sale price
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Your Earnings:
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    96% of sale price
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Example:</span>
                  <span className="text-sm font-semibold text-foreground">
                    ₦1,500 sale → You earn ₦1,440
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Last Updated */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Last updated: {formatDate(earnings.last_updated)}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}


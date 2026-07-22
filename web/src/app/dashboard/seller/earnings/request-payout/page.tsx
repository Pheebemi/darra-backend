"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Wallet,
  ArrowUpCircle,
  CheckCircle2,
  CreditCard,
  Building2,
  User,
  Info,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface BankAccount {
  id: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
}

interface EarningsData {
  total_sales: number;
  total_commission: number;
  total_payouts: number;
  available_balance: number;
  last_updated: string;
}

export default function RequestPayoutPage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [selectedBank, setSelectedBank] = useState<BankAccount | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loadingEarnings, setLoadingEarnings] = useState(true);
  const [loadingBanks, setLoadingBanks] = useState(true);

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchEarnings();
      fetchBankAccounts();
    }
  }, [isAuthenticated]);

  const fetchEarnings = async () => {
    try {
      setLoadingEarnings(true);
      const response = await fetch("/api/seller/earnings");
      if (!response.ok) {
        throw new Error("Failed to fetch earnings");
      }
      const data = await response.json();
      
      const parseDecimal = (value: any): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };
      
      setEarnings({
        total_sales: parseDecimal(data.total_sales),
        total_commission: parseDecimal(data.total_commission),
        total_payouts: parseDecimal(data.total_payouts),
        available_balance: parseDecimal(data.available_balance),
        last_updated: data.last_updated || new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("Error fetching earnings:", error);
      toast.error("Failed to fetch earnings data");
    } finally {
      setLoadingEarnings(false);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      setLoadingBanks(true);
      const response = await fetch("/api/seller/bank-accounts");
      if (!response.ok) {
        throw new Error("Failed to fetch bank accounts");
      }
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setBankAccounts(data);
        // Auto-select first bank account if available
        if (data.length > 0) {
          setSelectedBank(data[0]);
        }
      } else {
        setBankAccounts([]);
      }
    } catch (error: any) {
      console.error("Error fetching bank accounts:", error);
      toast.error("Failed to fetch bank accounts. Please try again.");
    } finally {
      setLoadingBanks(false);
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

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove non-numeric characters
    const numericText = e.target.value.replace(/[^0-9]/g, "");
    setAmount(numericText);
  };

  const validateForm = () => {
    if (!amount || parseFloat(amount) === 0) {
      toast.error("Please enter a valid amount");
      return false;
    }

    const numAmount = parseFloat(amount);
    if (numAmount < 1000) {
      toast.error("Minimum payout amount is ₦1,000");
      return false;
    }

    if (earnings && numAmount > earnings.available_balance) {
      toast.error(
        `Insufficient balance. Available: ${formatCurrency(earnings.available_balance)}`
      );
      return false;
    }

    if (!selectedBank) {
      toast.error("Please select a bank account");
      return false;
    }

    return true;
  };

  const handleRequestPayout = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/seller/request-payout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          bank_details: selectedBank!.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || "Failed to submit payout request");
      }

      const data = await response.json();
      toast.success(
        data.message ||
          `Payout request of ${formatCurrency(parseFloat(amount))} submitted. You will be paid within 12-14 hours.`
      );

      // Navigate to history after a short delay
      setTimeout(() => {
        router.push("/dashboard/seller/earnings/payout-history");
      }, 2000);

      // Reset form
      setAmount("");
      setSelectedBank(null);
    } catch (error: any) {
      console.error("Error requesting payout:", error);
      toast.error(error.message || "Failed to submit payout request. Please try again.");
    } finally {
      setLoading(false);
    }
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

  if (loadingEarnings) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-4xl px-6 py-8">
          <Skeleton className="mb-6 h-10 w-48" />
          <Skeleton className="mb-6 h-48 w-full" />
          <Skeleton className="mb-6 h-32 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6 p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-500">Finance</p>
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Request Payout</h1>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/seller/earnings">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        {/* Available Balance hero */}
        <div className="rounded-3xl bg-brand-950 p-6 text-center sm:p-8">
          <div className="mb-4 inline-flex rounded-2xl bg-brand-500/20 p-3">
            <Wallet className="h-6 w-6 text-brand-300" />
          </div>
          <p className="text-sm text-brand-200/70">Available Balance</p>
          <p className="mt-1 text-4xl font-bold text-white">
            {earnings ? formatCurrency(earnings.available_balance) : "₦0"}
          </p>
          <p className="mt-2 text-sm text-brand-200">
            This is the amount available for payout
          </p>
        </div>

        {/* Amount Input */}
        <div className="rounded-3xl border border-gray-100 bg-white p-6">
          <Label htmlFor="amount" className="mb-4 block text-lg font-semibold text-ink">
            Payout Amount
          </Label>
          <div className="flex items-center gap-2 rounded-2xl bg-brand-50 p-4 focus-within:ring-2 focus-within:ring-brand-300">
            <span className="text-2xl font-bold text-ink">₦</span>
            <Input
              id="amount"
              type="text"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0"
              className="border-0 bg-transparent text-2xl font-bold shadow-none focus-visible:ring-0"
              maxLength={10}
            />
          </div>
          <p className="mt-3 text-center text-xs text-gray-600">
            Minimum: ₦1,000 • Maximum:{" "}
            {earnings ? formatCurrency(earnings.available_balance) : "₦0"}
          </p>
        </div>

        {/* Bank Account Selection */}
        <div className="rounded-3xl border border-gray-100 bg-white p-6">
          <Label className="mb-4 block text-lg font-semibold text-ink">Select Bank Account</Label>

          {loadingBanks ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="mb-4 h-6 w-6 animate-spin text-brand-500" />
              <p className="text-sm text-gray-600">Loading bank accounts...</p>
            </div>
          ) : (
            <>
              {bankAccounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100">
                    <CreditCard className="h-7 w-7 text-brand-500" />
                  </div>
                  <h3 className="mb-1 text-lg font-semibold text-ink">No bank accounts found</h3>
                  <p className="mb-6 text-center text-sm text-gray-600">
                    Add a bank account in your profile to request payouts
                  </p>
                  <Button asChild>
                    <Link href="/dashboard/seller/settings">Add Bank Account</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {bankAccounts.map((bank) => (
                    <button
                      key={bank.id}
                      onClick={() => setSelectedBank(bank)}
                      className={`w-full rounded-2xl border-2 p-4 text-left transition-colors ${
                        selectedBank?.id === bank.id
                          ? "border-brand-500 bg-brand-50"
                          : "border-gray-100 hover:border-brand-200 hover:bg-brand-50/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100">
                            <Building2 className="h-5 w-5 text-brand-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-ink">{bank.bank_name}</p>
                            <p className="text-sm text-gray-600">
                              {bank.account_number}
                            </p>
                            <p className="text-xs text-gray-500">{bank.account_name}</p>
                          </div>
                        </div>
                        {selectedBank?.id === bank.id && (
                          <CheckCircle2 className="h-6 w-6 text-brand-500" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Payout Summary */}
        {amount && selectedBank && (
          <div className="rounded-3xl bg-brand-50 p-6">
            <h3 className="mb-4 text-lg font-semibold text-ink">Payout Summary</h3>
            <div className="space-y-3">
              {[
                { k: "Amount", v: formatCurrency(parseFloat(amount)) },
                { k: "Bank", v: selectedBank.bank_name },
                { k: "Account", v: selectedBank.account_number },
                { k: "Recipient", v: selectedBank.account_name },
              ].map(({ k, v }) => (
                <div key={k} className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5">
                  <span className="text-sm font-medium text-gray-600">{k}</span>
                  <span className="text-sm font-semibold text-ink">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleRequestPayout}
          disabled={!amount || !selectedBank || loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-8 py-4 text-lg font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300 active:bg-brand-700 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <ArrowUpCircle className="h-5 w-5" />
              Request Payout
            </>
          )}
        </button>

        {/* Info Section */}
        <div className="rounded-3xl bg-page-warm p-6">
          <div className="mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-brand-500" />
            <h3 className="text-lg font-semibold text-ink">Important Information</h3>
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Payouts are processed within 12-14 hours</li>
            <li>• You'll receive a confirmation email once processed</li>
            <li>• Minimum payout amount is ₦1,000</li>
            <li>• Platform fee of 4% is already deducted from your sales</li>
            <li>• You can track your payout status in Payout History</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}



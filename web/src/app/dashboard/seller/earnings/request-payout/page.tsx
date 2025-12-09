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
          `Payout request of ${formatCurrency(parseFloat(amount))} has been submitted successfully.`
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
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/seller/earnings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Request Payout</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Request a payout to your bank account
            </p>
          </div>
        </div>

        {/* Available Balance Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex items-center gap-2">
                <Wallet className="h-6 w-6 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Available Balance</h2>
              </div>
              <p className="text-4xl font-bold text-foreground">
                {earnings ? formatCurrency(earnings.available_balance) : "₦0"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                This is the amount available for payout
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Amount Input */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <Label htmlFor="amount" className="mb-4 text-lg font-semibold">
              Payout Amount
            </Label>
            <div className="flex items-center gap-2 rounded-lg border p-4">
              <span className="text-2xl font-bold text-foreground">₦</span>
              <Input
                id="amount"
                type="text"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0"
                className="border-0 text-2xl font-bold focus-visible:ring-0"
                maxLength={10}
              />
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Minimum: ₦1,000 • Maximum:{" "}
              {earnings ? formatCurrency(earnings.available_balance) : "₦0"}
            </p>
          </CardContent>
        </Card>

        {/* Bank Account Selection */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <Label className="mb-4 text-lg font-semibold">Select Bank Account</Label>

            {loadingBanks ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="mb-4 h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading bank accounts...</p>
              </div>
            ) : (
              <>
                {bankAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <CreditCard className="mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-2 text-lg font-semibold">No bank accounts found</h3>
                    <p className="mb-6 text-center text-sm text-muted-foreground">
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
                        className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
                          selectedBank?.id === bank.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{bank.bank_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {bank.account_number}
                              </p>
                              <p className="text-xs text-muted-foreground">{bank.account_name}</p>
                            </div>
                          </div>
                          {selectedBank?.id === bank.id && (
                            <CheckCircle2 className="h-6 w-6 text-primary" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Payout Summary */}
        {amount && selectedBank && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="mb-4 text-lg font-semibold">Payout Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Amount:</span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(parseFloat(amount))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Bank:</span>
                  <span className="text-sm font-semibold text-foreground">
                    {selectedBank.bank_name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Account:</span>
                  <span className="text-sm font-semibold text-foreground">
                    {selectedBank.account_number}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Recipient:</span>
                  <span className="text-sm font-semibold text-foreground">
                    {selectedBank.account_name}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <div className="mb-6">
          <Button
            onClick={handleRequestPayout}
            disabled={!amount || !selectedBank || loading}
            size="lg"
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <ArrowUpCircle className="mr-2 h-5 w-5" />
                Request Payout
              </>
            )}
          </Button>
        </div>

        {/* Info Section */}
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Important Information</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Payouts are processed within 24-48 hours</li>
              <li>• You'll receive a confirmation email once processed</li>
              <li>• Minimum payout amount is ₦1,000</li>
              <li>• Platform fee of 4% is already deducted from your sales</li>
              <li>• You can track your payout status in Payout History</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}



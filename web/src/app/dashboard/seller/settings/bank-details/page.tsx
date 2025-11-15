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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  User,
  CheckCircle2,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface Bank {
  name: string;
  code: string;
}

interface SavedBankAccount {
  id: string;
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  is_primary?: boolean;
  created_at: string;
}

export default function BankDetailsPage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const [savedAccounts, setSavedAccounts] = useState<SavedBankAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add new account states
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [selectedBankName, setSelectedBankName] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [accountName, setAccountName] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(false);

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSavedAccounts();
      fetchBanks();
    }
  }, [isAuthenticated]);

  const fetchSavedAccounts = async () => {
    try {
      setIsLoadingAccounts(true);
      const response = await fetch("/api/bank-details");
      if (!response.ok) {
        throw new Error("Failed to fetch bank accounts");
      }
      const data = await response.json();
      setSavedAccounts(Array.isArray(data) ? data : []);

      // If no accounts exist, show add form by default
      if (data.length === 0) {
        setShowAddForm(true);
      }
    } catch (error: any) {
      console.error("Error fetching bank accounts:", error);
      toast.error("Failed to load bank accounts");
    } finally {
      setIsLoadingAccounts(false);
      setRefreshing(false);
    }
  };

  const fetchBanks = async () => {
    try {
      setLoadingBanks(true);
      const response = await fetch("/api/banks");
      if (!response.ok) {
        throw new Error("Failed to fetch banks");
      }
      const data = await response.json();
      setBanks(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error("Error fetching banks:", error);
      toast.error("Failed to fetch banks");
    } finally {
      setLoadingBanks(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchSavedAccounts();
  };

  const validateAndSaveAccount = async () => {
    if (!selectedBank || !accountNumber || !selectedBankName) {
      toast.error("Please select a bank and enter account number");
      return;
    }

    setIsValidating(true);
    try {
      const response = await fetch("/api/bank-details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bank_code: selectedBank,
          bank_name: selectedBankName,
          account_number: accountNumber,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || "Account validation failed");
      }

      const data = await response.json();
      if (data.status) {
        setAccountName(data.account_name);
        toast.success("Account validated and saved!");
        resetForm();
        setShowAddForm(false);
        fetchSavedAccounts();
      } else {
        toast.error(data.message || "Account validation failed");
      }
    } catch (error: any) {
      console.error("Error validating account:", error);
      toast.error(error.message || "Network error. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const resetForm = () => {
    setSelectedBank("");
    setSelectedBankName("");
    setAccountNumber("");
    setAccountName("");
  };

  const selectBank = (bankCode: string, bankName: string) => {
    setSelectedBank(bankCode);
    setSelectedBankName(bankName);
    setAccountName(""); // Clear previous account name when bank changes
  };

  const deleteAccount = async (accountId: string) => {
    if (!confirm("Are you sure you want to delete this bank account?")) {
      return;
    }

    try {
      const response = await fetch(`/api/bank-details/${accountId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete bank account");
      }

      toast.success("Bank account deleted successfully");
      fetchSavedAccounts();
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete bank account");
    }
  };

  if (!initialized || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-foreground/70">Loading...</p>
      </div>
    );
  }

  if (isLoadingAccounts) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-4xl px-6 py-8">
          <Skeleton className="mb-6 h-10 w-48" />
          <Skeleton className="mb-6 h-64 w-full" />
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
            <Link href="/dashboard/seller/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">Bank Accounts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {savedAccounts.length > 0
                ? `You have ${savedAccounts.length} bank account${savedAccounts.length > 1 ? "s" : ""}`
                : "No bank accounts added yet"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Empty State */}
        {savedAccounts.length === 0 && !showAddForm && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 text-6xl">🏦</div>
              <h3 className="mb-2 text-xl font-semibold">No Bank Accounts</h3>
              <p className="mb-6 text-center text-sm text-muted-foreground">
                Add your bank account details to receive payments and withdrawals
              </p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Bank Account
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Existing Bank Accounts */}
        {savedAccounts.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-4 text-lg font-semibold">Your Bank Accounts</h2>
            <div className="space-y-4">
              {savedAccounts.map((account) => (
                <Card key={account.id}>
                  <CardContent className="p-6">
                    {account.is_primary && (
                      <Badge className="mb-4 bg-primary">PRIMARY</Badge>
                    )}
                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-foreground">
                        {account.account_name}
                      </p>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        <span>{account.bank_name}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
                        <CreditCard className="h-4 w-4" />
                        <span>{account.account_number}</span>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteAccount(account.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Add New Account Form */}
        {showAddForm && (
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-6 text-xl font-semibold">Add New Bank Account</h2>

              <div className="space-y-4">
                {/* Bank Selection */}
                <div className="space-y-2">
                  <Label htmlFor="bank">Select Bank</Label>
                  {loadingBanks ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      value={selectedBank}
                      onValueChange={(value) => {
                        const bank = banks.find((b) => b.code === value);
                        if (bank) {
                          selectBank(bank.code, bank.name);
                        }
                      }}
                    >
                      <SelectTrigger id="bank">
                        <SelectValue placeholder="Select Bank" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((bank) => (
                          <SelectItem key={bank.code} value={bank.code}>
                            {bank.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Account Number */}
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    type="text"
                    placeholder="Enter account number"
                    value={accountNumber}
                    onChange={(e) => {
                      const numericValue = e.target.value.replace(/[^0-9]/g, "");
                      setAccountNumber(numericValue);
                      setAccountName(""); // Clear account name when number changes
                    }}
                    maxLength={10}
                  />
                </div>

                {/* Validate & Save Button */}
                <Button
                  onClick={validateAndSaveAccount}
                  disabled={isValidating || !selectedBank || !accountNumber}
                  className="w-full"
                  size="lg"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Validate & Save Account
                    </>
                  )}
                </Button>

                {/* Account Name Display */}
                {accountName && (
                  <div className="rounded-lg border-l-4 border-primary bg-primary/10 p-4">
                    <p className="font-medium text-primary">
                      ✓ Account Name: {accountName}
                    </p>
                  </div>
                )}

                {/* Cancel Button */}
                <Button
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setShowAddForm(false);
                  }}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Another Account Button */}
        {savedAccounts.length > 0 && !showAddForm && (
          <Button onClick={() => setShowAddForm(true)} className="w-full" size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Add New Bank Account
          </Button>
        )}
      </div>
    </DashboardLayout>
  );
}


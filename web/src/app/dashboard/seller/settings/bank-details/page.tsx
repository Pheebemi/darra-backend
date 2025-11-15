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
  Search,
  ChevronDown,
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
  
  // Enhanced bank selection states
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `Failed to fetch banks (${response.status})`;
        console.error("Error fetching banks:", {
          status: response.status,
          statusText: response.statusText,
          errorData,
        });
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setBanks(data);
      } else if (data && Array.isArray(data.data)) {
        setBanks(data.data);
      } else {
        console.error("Unexpected banks data format:", data);
        setBanks([]);
        toast.error("Invalid banks data format received");
      }
    } catch (error: any) {
      console.error("Error fetching banks:", error);
      const errorMessage = error.message || "Failed to fetch banks. Please check your Paystack configuration.";
      toast.error(errorMessage);
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
    setSearchQuery("");
  };

  const selectBank = (bankCode: string, bankName: string) => {
    setSelectedBank(bankCode);
    setSelectedBankName(bankName);
    setAccountName("");
    setIsDropdownOpen(false);
    setSearchQuery("");
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

  // Filter banks based on search query
  const filteredBanks = banks.filter(bank =>
    bank.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedBankObj = banks.find(bank => bank.code === selectedBank);

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
                {/* Enhanced Bank Selection */}
                <div className="space-y-2">
                  <Label htmlFor="bank">Select Bank</Label>
                  {loadingBanks ? (
                    <div className="space-y-2">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-8 w-3/4" />
                    </div>
                  ) : (
                    <div className="relative">
                      <Select
                        value={selectedBank}
                        open={isDropdownOpen}
                        onOpenChange={setIsDropdownOpen}
                      >
                        <SelectTrigger 
                          id="bank"
                          className="h-12 w-full"
                        >
                          <SelectValue>
                            {selectedBankObj ? (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span>{selectedBankObj.name}</span>
                              </div>
                            ) : (
                              "Select Bank"
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent 
                          className="w-full p-2"
                          position="popper"
                          sideOffset={4}
                        >
                          {/* Search Input */}
                          <div className="relative mb-2 p-2">
                            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                            <Input
                              placeholder="Search banks..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-10 pr-4"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>

                          {/* Banks List */}
                          <div className="max-h-60 overflow-y-auto">
                            {filteredBanks.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-8 text-center">
                                <AlertCircle className="mb-2 h-8 w-8 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">No banks found</p>
                                <p className="text-xs text-muted-foreground">
                                  Try a different search term
                                </p>
                              </div>
                            ) : (
                              filteredBanks.map((bank) => (
                                <SelectItem 
                                  key={bank.code} 
                                  value={bank.code}
                                  className="cursor-pointer py-3"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                      <Building2 className="h-4 w-4 text-primary" />
                                    </div>
                                    <span className="font-medium">{bank.name}</span>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </div>

                          {/* Banks Count */}
                          <div className="border-t p-2">
                            <p className="text-xs text-muted-foreground text-center">
                              {filteredBanks.length} of {banks.length} banks
                            </p>
                          </div>
                        </SelectContent>
                      </Select>
                    </div>
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
                      setAccountName("");
                    }}
                    maxLength={10}
                    className="h-12"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter 10-digit account number
                  </p>
                </div>

                {/* Account Name Preview */}
                {accountName && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className="font-medium text-foreground">Account Verified</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Account Name: <span className="font-semibold text-foreground">{accountName}</span>
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={validateAndSaveAccount}
                    disabled={isValidating || !selectedBank || accountNumber.length !== 10}
                    className="flex-1"
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
                        Save Account
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setShowAddForm(false);
                    }}
                    className="flex-1"
                    size="lg"
                  >
                    Cancel
                  </Button>
                </div>

                {/* Validation Help */}
                {accountNumber.length > 0 && accountNumber.length !== 10 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm text-amber-800">
                      Please enter a complete 10-digit account number
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Another Account Button */}
        {savedAccounts.length > 0 && !showAddForm && (
          <Button 
            onClick={() => setShowAddForm(true)} 
            className="w-full" 
            size="lg"
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Bank Account
          </Button>
        )}
      </div>
    </DashboardLayout>
  );
}
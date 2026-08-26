"use client";
import { useCallback, useEffect, useState } from "react";
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
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Tag, Trash2, Loader2, Users, Percent, Banknote } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api/errors";

interface ProductLite {
  id: number;
  title: string;
}

interface Coupon {
  id: number;
  code: string;
  discount_type: "percent" | "fixed";
  value: string;
  product_details: ProductLite[];
  max_redemptions: number | null;
  max_redemptions_per_buyer: number;
  expires_at: string | null;
  is_active: boolean;
  redemptions: number;
  revenue: string;
  created_at: string;
}

function discountLabel(coupon: Coupon) {
  return coupon.discount_type === "percent"
    ? `${Number(coupon.value)}% off`
    : `₦${Number(coupon.value).toLocaleString()} off`;
}

function isExpired(coupon: Coupon) {
  return !!coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now();
}

export default function SellerDiscountsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("20");
  const [scope, setScope] = useState<"all" | "specific">("all");
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [maxPerBuyer, setMaxPerBuyer] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/seller/coupons");
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load discount codes");
      setCoupons(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load discount codes"));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/seller/products");
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.results || [];
      setProducts(list.map((p: { id: number; title: string }) => ({ id: p.id, title: p.title })));
    } catch {
      // Non-fatal — the "specific products" scope just won't have anything to pick.
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
    fetchProducts();
  }, [fetchCoupons, fetchProducts]);

  const resetForm = () => {
    setCode("");
    setDiscountType("percent");
    setValue("20");
    setScope("all");
    setSelectedProductIds([]);
    setMaxRedemptions("");
    setMaxPerBuyer("1");
    setExpiresAt("");
  };

  const handleCreate = async () => {
    if (!code.trim()) {
      toast.error("Give the code a name buyers will type");
      return;
    }
    const numericValue = Number(value);
    if (!numericValue || numericValue <= 0) {
      toast.error("Enter a discount amount");
      return;
    }
    if (discountType === "percent" && numericValue > 50) {
      toast.error("Percentage discounts are capped at 50%");
      return;
    }
    if (scope === "specific" && selectedProductIds.length === 0) {
      toast.error("Pick at least one product, or switch to all products");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/seller/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          discount_type: discountType,
          value: numericValue,
          products: scope === "specific" ? selectedProductIds : [],
          max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
          max_redemptions_per_buyer: Number(maxPerBuyer) || 1,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create discount code");
      toast.success(`${data.code} is live`);
      setDialogOpen(false);
      resetForm();
      fetchCoupons();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to create discount code"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      setTogglingId(coupon.id);
      const res = await fetch(`/api/seller/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !coupon.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update discount code");
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: data.is_active } : c))
      );
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update discount code"));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (coupon: Coupon) => {
    if (!confirm(`Delete ${coupon.code}? Buyers won't be able to use it anymore.`)) return;
    try {
      setDeletingId(coupon.id);
      const res = await fetch(`/api/seller/coupons/${coupon.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete discount code");
      setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
      toast.success("Discount code deleted");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete discount code"));
    } finally {
      setDeletingId(null);
    }
  };

  // A representative ₦10,000 sale, so the seller sees what the number they
  // just typed actually does to their payout before they save it. Commission
  // is always 4% of the full price — the coupon never changes what Darra
  // takes, only what's left over for the seller.
  const previewValue = Number(value) || 0;
  const sampleList = 10000;
  const sampleDiscount =
    discountType === "percent"
      ? Math.round(sampleList * (previewValue / 100))
      : Math.min(previewValue, sampleList);
  const samplePaid = sampleList - sampleDiscount;
  const sampleCommission = Math.round(sampleList * 0.04);
  const samplePayout = samplePaid - sampleCommission;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent-link">
              Marketing
            </p>
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Discounts</h1>
            <p className="mt-1 text-sm text-body">
              Codes buyers apply at checkout. They only ever discount your own products.
            </p>
          </div>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}
          >
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create code
            </Button>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>New discount code</DialogTitle>
              </DialogHeader>

              <div className="space-y-5 py-2">
                <div>
                  <Label htmlFor="coupon-code">Code</Label>
                  <Input
                    id="coupon-code"
                    placeholder="LAUNCH20"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="mt-1.5 font-mono uppercase"
                    maxLength={32}
                  />
                  <p className="mt-1 text-xs text-faint">What buyers type in their cart.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Discount type</Label>
                    <Select value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="coupon-value">
                      {discountType === "percent" ? "Percent off" : "Amount off (₦)"}
                    </Label>
                    <div className="relative mt-1.5">
                      {discountType === "percent" ? (
                        <Percent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                      ) : (
                        <Banknote className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                      )}
                      <Input
                        id="coupon-value"
                        type="number"
                        min={1}
                        max={discountType === "percent" ? 50 : undefined}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {discountType === "percent" && (
                      <p className="mt-1 text-xs text-faint">Capped at 50%.</p>
                    )}
                  </div>
                </div>

                {/* Payout preview — the whole point is seeing this before saving. */}
                <div className="rounded-2xl bg-brand-soft px-4 py-3 text-sm">
                  <p className="font-medium text-strong">On a ₦{sampleList.toLocaleString()} sale</p>
                  <div className="mt-1.5 space-y-0.5 text-body">
                    <p>
                      Buyer pays <span className="font-semibold text-ink">₦{samplePaid.toLocaleString()}</span>
                      {sampleDiscount > 0 && (
                        <span className="text-faint"> (−₦{sampleDiscount.toLocaleString()})</span>
                      )}
                    </p>
                    <p>
                      You receive <span className="font-semibold text-ink">₦{samplePayout.toLocaleString()}</span>
                      <span className="text-faint"> — commission stays ₦{sampleCommission.toLocaleString()}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <Label>Applies to</Label>
                  <Select value={scope} onValueChange={(v) => setScope(v as "all" | "specific")}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All my products</SelectItem>
                      <SelectItem value="specific">Specific products</SelectItem>
                    </SelectContent>
                  </Select>
                  {scope === "specific" && (
                    <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-line p-3">
                      {products.length === 0 ? (
                        <p className="text-sm text-faint">No products yet.</p>
                      ) : (
                        products.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 text-sm text-body">
                            <Checkbox
                              checked={selectedProductIds.includes(p.id)}
                              onCheckedChange={(checked) =>
                                setSelectedProductIds((prev) =>
                                  checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                                )
                              }
                            />
                            {p.title}
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="max-redemptions">Max uses</Label>
                    <Input
                      id="max-redemptions"
                      type="number"
                      min={1}
                      placeholder="Unlimited"
                      value={maxRedemptions}
                      onChange={(e) => setMaxRedemptions(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="max-per-buyer">Uses per buyer</Label>
                    <Input
                      id="max-per-buyer"
                      type="number"
                      min={1}
                      value={maxPerBuyer}
                      onChange={(e) => setMaxPerBuyer(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="expires-at">Expires (optional)</Label>
                  <Input
                    id="expires-at"
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="mt-1.5"
                  />
                </div>

                <Button onClick={handleCreate} disabled={saving} className="w-full">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
                    </>
                  ) : (
                    "Create code"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-3xl" />
            <Skeleton className="h-24 w-full rounded-3xl" />
          </div>
        ) : coupons.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <img src="/illustrations/no-data.svg" alt="" className="mb-6 h-32 w-auto" />
              <h3 className="mb-2 text-xl font-semibold text-ink">No discount codes yet</h3>
              <p className="mb-6 max-w-sm text-center text-sm text-body">
                Create a code and share it with your audience — it only ever discounts your own products.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first code
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {coupons.map((coupon) => {
              const expired = isExpired(coupon);
              const exhausted =
                coupon.max_redemptions !== null && coupon.redemptions >= coupon.max_redemptions;
              return (
                <div key={coupon.id} className="rounded-3xl border border-line bg-surface p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-softer">
                        <Tag className="h-6 w-6 text-accent-link" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-lg font-semibold text-ink">{coupon.code}</p>
                          <span className="rounded-full bg-brand-softer px-2.5 py-0.5 text-[10px] font-semibold text-brand-700">
                            {discountLabel(coupon)}
                          </span>
                          {!coupon.is_active && (
                            <span className="rounded-full bg-inset px-2.5 py-0.5 text-[10px] font-semibold text-subtle">
                              PAUSED
                            </span>
                          )}
                          {expired && (
                            <span className="rounded-full bg-err-soft px-2.5 py-0.5 text-[10px] font-semibold text-err">
                              EXPIRED
                            </span>
                          )}
                          {exhausted && (
                            <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-[10px] font-semibold text-warn">
                              FULLY REDEEMED
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-body">
                          {coupon.product_details.length === 0
                            ? "All products"
                            : coupon.product_details.map((p) => p.title).join(", ")}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-faint">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {coupon.redemptions} use{coupon.redemptions === 1 ? "" : "s"}
                            {coupon.max_redemptions ? ` / ${coupon.max_redemptions}` : ""}
                          </span>
                          <span>₦{Number(coupon.revenue || 0).toLocaleString()} in sales</span>
                          {coupon.expires_at && (
                            <span>Expires {new Date(coupon.expires_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={togglingId === coupon.id}
                        onClick={() => toggleActive(coupon)}
                      >
                        {togglingId === coupon.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : coupon.is_active ? (
                          "Pause"
                        ) : (
                          "Resume"
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deletingId === coupon.id}
                        onClick={() => handleDelete(coupon)}
                      >
                        {deletingId === coupon.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
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

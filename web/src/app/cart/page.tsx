"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import { useCart } from "@/lib/cart/cart-context";
import { useAuth } from "@/lib/auth/auth-context";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Minus, ArrowRight, Shield, Zap, Package, CreditCard } from "lucide-react";
import { toast } from "sonner";

export default function CartPage() {
  const { items, removeItem, updateQuantity, getTotal, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.push("/login");
  }, [isAuthenticated, router]);

  const handleCheckout = async () => {
    if (!user?.email) { toast.error("Please log in to checkout"); return; }
    if (items.length === 0) { toast.error("Your cart is empty"); return; }

    try {
      setProcessing(true);
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
            ...(item.tierId && { ticket_tier_id: item.tierId }),
          })),
          email: user.email,
          payment_provider: "flutterwave",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Checkout failed");
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error("No payment URL received");
      }
    } catch (error: any) {
      toast.error(error.message || "Checkout failed. Please try again.");
      setProcessing(false);
    }
  };

  if (!isAuthenticated) return null;

  const total = getTotal();
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center bg-page px-5">
        <div className="text-center">
          <img src="/illustrations/empty-cart.svg" alt="" className="mx-auto mb-6 h-44 w-auto" />
          <h2 className="mb-1 text-2xl font-semibold text-ink">Your cart is empty</h2>
          <p className="mb-6 text-body">Add products to get started</p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300"
          >
            Browse Products
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-16">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-accent-link">Checkout</p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">Cart</h1>
            <p className="mt-1 text-body">{totalItems} {totalItems === 1 ? "item" : "items"}</p>
          </div>
          <button
            onClick={clearCart}
            className="text-sm font-medium text-body transition-colors hover:text-err"
          >
            Clear all
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Items */}
          <div className="space-y-3 lg:col-span-2">
            {items.map((item, index) => {
              const price = item.tier?.price || item.product?.price || 0;
              const itemTotal = price * item.quantity;

              return (
                <div
                  key={`${item.productId}-${item.tierId || "none"}-${index}`}
                  className="flex gap-4 rounded-3xl border border-line bg-surface p-4"
                >
                  {/* Cover */}
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-brand-soft">
                    {item.product?.cover_image ? (
                      <SafeImage
                        src={item.product.cover_image}
                        alt={item.product.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-6 w-6 text-brand-300" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-strong">{item.product?.title || "Product"}</p>
                        {item.tier && (
                          <p className="text-sm text-body">{item.tier.name}</p>
                        )}
                      </div>
                      <p className="shrink-0 font-semibold text-accent-link">
                        ₦{price.toLocaleString()}
                      </p>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      {/* Quantity */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.productId, item.tierId, item.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-line-strong text-body transition-colors hover:border-brand-500 hover:text-accent-link"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.tierId, item.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-line-strong text-body transition-colors hover:border-brand-500 hover:text-accent-link"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-4">
                        <p className="font-semibold text-ink">₦{itemTotal.toLocaleString()}</p>
                        <button
                          onClick={() => removeItem(item.productId, item.tierId)}
                          className="text-faint transition-colors hover:text-err"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4 rounded-3xl border border-line bg-surface p-6">
              <h2 className="text-xl font-semibold text-ink">Order Summary</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-body">Subtotal ({totalItems} {totalItems === 1 ? "item" : "items"})</span>
                  <span className="text-strong">₦{total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-body">Processing fee</span>
                  <span className="text-body">Calculated at checkout</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between font-semibold">
                <span className="text-ink">Total</span>
                <span className="text-accent-link">₦{total.toLocaleString()}</span>
              </div>

              {/* Payment method */}
              <div className="flex items-center gap-2 rounded-2xl bg-brand-soft px-4 py-3">
                <CreditCard className="h-4 w-4 shrink-0 text-accent-link" />
                <span className="text-xs text-body">Flutterwave · Secure checkout</span>
              </div>

              {/* Trust */}
              <div className="flex justify-around text-xs text-body">
                <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-accent-link" />Secure</span>
                <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-accent-link" />Instant</span>
                <span className="flex items-center gap-1"><Package className="h-3 w-3 text-accent-link" />Guaranteed</span>
              </div>

              <button
                className="w-full rounded-full bg-brand-500 px-6 py-3.5 font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300 active:bg-brand-700 disabled:opacity-60"
                onClick={handleCheckout}
                disabled={processing}
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    Pay now
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </button>

              <Link
                href="/products"
                className="block w-full rounded-full border border-brand-500 px-6 py-2.5 text-center text-sm font-medium text-accent-link transition-colors hover:bg-brand-500 hover:text-white"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

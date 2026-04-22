"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import { useCart } from "@/lib/cart/cart-context";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight, Shield, Zap, Package, CreditCard } from "lucide-react";
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
      <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border bg-muted">
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="mb-1 text-base font-semibold">Your cart is empty</h2>
          <p className="mb-5 text-sm text-muted-foreground">Add products to get started</p>
          <Button size="sm" asChild>
            <Link href="/products">
              Browse Products
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Cart</h1>
          <p className="text-sm text-muted-foreground">{totalItems} {totalItems === 1 ? "item" : "items"}</p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-muted-foreground transition-colors hover:text-destructive"
        >
          Clear all
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items */}
        <div className="space-y-2 lg:col-span-2">
          {items.map((item, index) => {
            const price = item.tier?.price || item.product?.price || 0;
            const itemTotal = price * item.quantity;

            return (
              <div
                key={`${item.productId}-${item.tierId || "none"}-${index}`}
                className="flex gap-3 rounded-lg border bg-card p-3"
              >
                {/* Cover */}
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.product?.cover_image ? (
                    <SafeImage
                      src={item.product.cover_image}
                      alt={item.product.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col justify-between min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.product?.title || "Product"}</p>
                      {item.tier && (
                        <p className="text-xs text-muted-foreground">{item.tier.name}</p>
                      )}
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-primary">
                      ₦{price.toLocaleString()}
                    </p>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    {/* Quantity */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.productId, item.tierId, item.quantity - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.tierId, item.quantity + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold">₦{itemTotal.toLocaleString()}</p>
                      <button
                        onClick={() => removeItem(item.productId, item.tierId)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
          <div className="sticky top-20 rounded-lg border bg-card p-4 space-y-4">
            <h2 className="text-sm font-semibold">Order Summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal ({totalItems} {totalItems === 1 ? "item" : "items"})</span>
                <span>₦{total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing fee</span>
                <span className="text-muted-foreground">Calculated at checkout</span>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span className="text-primary">₦{total.toLocaleString()}</span>
            </div>

            {/* Payment method */}
            <div className="rounded-md border bg-muted/40 px-3 py-2 flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Flutterwave · Secure checkout</span>
            </div>

            {/* Trust */}
            <div className="flex justify-around text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Shield className="h-3 w-3" />Secure</span>
              <span className="flex items-center gap-1"><Zap className="h-3 w-3" />Instant</span>
              <span className="flex items-center gap-1"><Package className="h-3 w-3" />Guaranteed</span>
            </div>

            <Button className="w-full" onClick={handleCheckout} disabled={processing}>
              {processing ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  Checkout
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </Button>

            <Button variant="outline" className="w-full" size="sm" asChild>
              <Link href="/products">Continue shopping</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart/cart-context";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight, Shield, Zap, Ticket, CreditCard } from "lucide-react";
import { toast } from "sonner";

export default function CartPage() {
  const { items, removeItem, updateQuantity, getTotal, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [provider] = useState<"flutterwave">("flutterwave"); // enforce Flutterwave only

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  const handleCheckout = async () => {
    if (!user?.email) {
      toast.error("Please log in to checkout");
      return;
    }

    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    try {
      setProcessing(true);

      const checkoutItems = items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        ...(item.tierId && { ticket_tier_id: item.tierId }),
      }));

      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: checkoutItems,
          email: user.email,
          payment_provider: provider,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Checkout failed");
      }

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

  if (!isAuthenticated) {
    return null;
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-900">
        <div className="absolute inset-0 bg-grid-slate-900/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-400/10 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />
        
        <div className="relative mx-auto max-w-4xl px-6 py-12">
          <div className="flex flex-col items-center justify-center py-20">
            <div className="rounded-2xl bg-white/80 p-8 backdrop-blur-xl dark:bg-slate-800/80 shadow-2xl text-center max-w-md">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 text-slate-400 mx-auto mb-6 dark:from-slate-700 dark:to-slate-600">
                <ShoppingCart className="h-10 w-10" />
              </div>
              <h2 className="mb-3 text-2xl font-semibold text-slate-900 dark:text-white">
                Your cart is empty
              </h2>
              <p className="mb-6 text-slate-600 dark:text-slate-300">
                Discover amazing events and add tickets to get started
              </p>
              <Button 
                asChild 
                className="rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
                size="lg"
              >
                <Link href="/tickets">
                  Browse Events
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const total = getTotal();
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-900">
      <div className="absolute inset-0 bg-grid-slate-900/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-400/10 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rggba(255,255,255,0.5))]" />
      
      <div className="relative mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg">
              <ShoppingCart className="h-8 w-8" />
            </div>
          </div>
          <h1 className="mb-3 text-4xl font-bold bg-gradient-to-br from-slate-900 to-blue-700 dark:from-slate-100 dark:to-blue-400 bg-clip-text text-transparent">
            Shopping Cart
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            Review your items and proceed to checkout
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <Badge className="rounded-full bg-blue-100 text-blue-700 border-none px-4 py-2 dark:bg-blue-900/30 dark:text-blue-300">
                {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </Badge>
              <Button 
                variant="ghost" 
                onClick={clearCart}
                className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Clear Cart
              </Button>
            </div>

            {items.map((item, index) => {
              const price = item.tier?.price || item.product?.price || 0;
              const itemTotal = price * item.quantity;

              return (
                <Card 
                  key={`${item.productId}-${item.tierId || "none"}-${index}`}
                  className="rounded-2xl border-slate-200/50 bg-white/80 backdrop-blur-xl transition-all hover:shadow-lg dark:border-slate-700/50 dark:bg-slate-800/80"
                >
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border-2 border-slate-200/50 dark:border-slate-700/50">
                        {item.product?.cover_image ? (
                          <Image
                            src={item.product.cover_image}
                            alt={item.product.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                            <Ticket className="h-8 w-8 text-blue-400/30" />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-slate-900 dark:text-white text-lg">
                                {item.product?.title || "Product"}
                              </h3>
                              {item.tier && (
                                <Badge className="rounded-full bg-green-100 text-green-700 mt-1 border-none dark:bg-green-900/30 dark:text-green-300">
                                  {item.tier.name}
                                </Badge>
                              )}
                            </div>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              ₦{price.toLocaleString()}
                            </p>
                          </div>
                          
                          {item.product?.is_ticket_event && (
                            <div className="flex items-center gap-2 mt-2">
                              <Ticket className="h-4 w-4 text-slate-400" />
                              <span className="text-sm text-slate-600 dark:text-slate-400">Event Ticket</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-xl border-slate-300 dark:border-slate-600"
                              onClick={() =>
                                updateQuantity(
                                  item.productId,
                                  item.tierId,
                                  item.quantity - 1
                                )
                              }
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center text-base font-semibold text-slate-900 dark:text-white">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-xl border-slate-300 dark:border-slate-600"
                              onClick={() =>
                                updateQuantity(
                                  item.productId,
                                  item.tierId,
                                  item.quantity + 1
                                )
                              }
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex items-center gap-4">
                            <p className="text-lg font-bold text-slate-900 dark:text-white">
                              ₦{itemTotal.toLocaleString()}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                              onClick={() => removeItem(item.productId, item.tierId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 rounded-2xl border-slate-200/50 bg-white/80 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/80">
              <CardContent className="p-6">
                <h2 className="mb-6 text-xl font-bold text-slate-900 dark:text-white">Order Summary</h2>
                
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Subtotal ({totalItems} items)</span>
                    <span className="font-medium">₦{total.toLocaleString()}</span>
                  </div>
                  
                  <Separator className="bg-slate-200/50 dark:bg-slate-700/50" />
                  
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-slate-900 dark:text-white">Total</span>
                    <span className="text-blue-600 dark:text-blue-400">₦{total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Payment Provider Selection - Flutterwave only */}
                <div className="mt-6">
                  <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Payment Provider</p>
                  <div className="grid grid-cols-1 gap-3">
                    <Button
                      type="button"
                      variant="default"
                      className="rounded-xl bg-purple-600 hover:bg-purple-700"
                      disabled
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Flutterwave
                    </Button>
                  </div>
                </div>

                {/* Trust Indicators */}
                <div className="mt-6 grid grid-cols-3 gap-3 rounded-xl bg-slate-100/50 p-3 dark:bg-slate-700/30">
                  <div className="flex flex-col items-center text-center">
                    <Shield className="h-4 w-4 text-green-600 mb-1" />
                    <span className="text-xs text-slate-600 dark:text-slate-400">Secure</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <Zap className="h-4 w-4 text-blue-600 mb-1" />
                    <span className="text-xs text-slate-600 dark:text-slate-400">Instant</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <Ticket className="h-4 w-4 text-purple-600 mb-1" />
                    <span className="text-xs text-slate-600 dark:text-slate-400">Guaranteed</span>
                  </div>
                </div>

                {/* Checkout Button */}
                <Button
                  className="mt-6 w-full rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 py-3 text-base font-semibold shadow-lg transition-all hover:from-blue-700 hover:to-purple-700 hover:shadow-xl disabled:opacity-50"
                  onClick={handleCheckout}
                  disabled={processing}
                  size="lg"
                >
                  {processing ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Proceed to Checkout
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  className="mt-3 w-full rounded-xl border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50 dark:hover:bg-slate-700"
                  asChild
                >
                  <Link href="/tickets">Continue Shopping</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
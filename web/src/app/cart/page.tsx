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
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function CartPage() {
  const { items, removeItem, updateQuantity, getTotal, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [provider, setProvider] = useState<"paystack" | "flutterwave">("paystack");

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

      // Redirect to payment URL
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
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex flex-col items-center justify-center py-12">
          <ShoppingCart className="h-16 w-16 text-foreground/30" />
          <h2 className="mt-4 text-2xl font-semibold">Your cart is empty</h2>
          <p className="mt-2 text-foreground/70">
            Add some tickets to get started
          </p>
          <Button asChild className="mt-6">
            <Link href="/tickets">Browse Tickets</Link>
          </Button>
        </div>
      </div>
    );
  }

  const total = getTotal();

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Shopping Cart</h1>
        <Button variant="ghost" onClick={clearCart} size="sm">
          Clear Cart
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          {items.map((item, index) => {
            const price = item.tier?.price || item.product?.price || 0;
            const itemTotal = price * item.quantity;

            return (
              <Card key={`${item.productId}-${item.tierId || "none"}-${index}`}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border">
                      {item.product?.cover_image ? (
                        <Image
                          src={item.product.cover_image}
                          alt={item.product.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-muted">
                          <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <h3 className="font-medium">{item.product?.title || "Product"}</h3>
                        {item.tier && (
                          <p className="text-sm text-foreground/70">
                            {item.tier.name}
                          </p>
                        )}
                        <p className="mt-1 text-sm font-semibold text-primary">
                          ₦{price.toLocaleString()} each
                        </p>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.tierId,
                                item.quantity - 1
                              )
                            }
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.tierId,
                                item.quantity + 1
                              )
                            }
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-4">
                          <p className="font-semibold">
                            ₦{itemTotal.toLocaleString()}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
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

        <div className="md:col-span-1">
          <Card className="sticky top-24">
            <CardContent className="p-6">
              <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/70">Subtotal</span>
                  <span>₦{total.toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-primary">₦{total.toLocaleString()}</span>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-2 text-sm font-medium">Payment provider</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={provider === "paystack" ? "default" : "outline"}
                    onClick={() => setProvider("paystack")}
                  >
                    Paystack
                  </Button>
                  <Button
                    type="button"
                    variant={provider === "flutterwave" ? "default" : "outline"}
                    onClick={() => setProvider("flutterwave")}
                  >
                    Flutterwave
                  </Button>
                </div>
              </div>

              <Button
                className="mt-6 w-full"
                onClick={handleCheckout}
                disabled={processing}
              >
                {processing ? "Processing..." : "Proceed to Checkout"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" className="mt-2 w-full" asChild>
                <Link href="/tickets">Continue Shopping</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}



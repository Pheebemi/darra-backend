"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SafeImage } from "@/components/safe-image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Ticket, Plus, Minus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-context";
import { useCart } from "@/lib/cart/cart-context";

interface TicketTier {
  id: number;
  name: string;
  price: number;
  quantity_available: number;
  remaining_quantity: number;
  description?: string;
  benefits?: string;
  is_sold_out: boolean;
}

interface Product {
  id: number;
  title: string;
  description: string;
  description_html?: string;
  price: number;
  product_type: string;
  cover_image?: string;
  file?: string;
  created_at: string;
  event_date?: string;
  ticket_tiers?: TicketTier[];
  is_ticket_event?: boolean;
  seller_name: string;
  seller_id: number;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedTiers, setSelectedTiers] = useState<Record<number, number>>({});

  useEffect(() => {
    if (params.id) {
      fetchProduct();
    }
  }, [params.id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/products/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch product");
      const data = await response.json();
      setProduct(data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load product");
      router.push("/tickets");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;

    // Check if user is trying to buy their own product
    if (product.seller_id === user?.id) {
      toast.error("You cannot add your own product to the cart.");
      return;
    }

    // For ticket events, show ticket selection modal
    if (product.is_ticket_event && product.ticket_tiers && product.ticket_tiers.length > 0) {
      const availableTiers = product.ticket_tiers.filter((tier) => !tier.is_sold_out);
      if (availableTiers.length === 0) {
        toast.error("All tickets for this event are sold out.");
        return;
      }
      setShowTicketModal(true);
    } else {
      // For regular products, add directly to cart
      handleAddToCartClick(product.id);
      toast.success("Added to cart!");
    }
  };

  const handleAddToCartClick = (productId: number, tierId?: number, quantity: number = 1) => {
    if (!product) return;
    
    const tier = tierId
      ? product.ticket_tiers?.find((t) => t.id === tierId)
      : undefined;

    addItem(
      productId,
      tierId,
      quantity,
      {
        id: product.id,
        title: product.title,
        price: product.price,
        cover_image: product.cover_image,
        product_type: product.product_type,
        is_ticket_event: product.is_ticket_event,
      },
      tier
        ? {
            id: tier.id,
            name: tier.name,
            price: tier.price,
          }
        : undefined
    );
  };

  const updateTierQuantity = (tierId: number, delta: number) => {
    const tier = product?.ticket_tiers?.find((t) => t.id === tierId);
    if (!tier) return;

    const currentQty = selectedTiers[tierId] || 0;
    const newQty = Math.max(0, Math.min(tier.remaining_quantity, currentQty + delta));

    if (newQty === 0) {
      const { [tierId]: _, ...rest } = selectedTiers;
      setSelectedTiers(rest);
    } else {
      setSelectedTiers({ ...selectedTiers, [tierId]: newQty });
    }
  };

  const handleAddSelectedTiersToCart = () => {
    const selectedTierIds = Object.keys(selectedTiers).map(Number);
    if (selectedTierIds.length === 0) {
      toast.error("Please select at least one ticket tier.");
      return;
    }

    selectedTierIds.forEach((tierId) => {
      const quantity = selectedTiers[tierId];
      if (quantity > 0) {
        handleAddToCartClick(product!.id, tierId, quantity);
      }
    });

    setShowTicketModal(false);
    setSelectedTiers({});
    toast.success("Tickets added to cart!");
  };

  const getTotalPrice = () => {
    if (!product) return 0;
    if (product.is_ticket_event && Object.keys(selectedTiers).length > 0) {
      return Object.entries(selectedTiers).reduce((total, [tierId, quantity]) => {
        const tier = product.ticket_tiers?.find((t) => t.id === Number(tierId));
        return total + (tier ? tier.price * quantity : 0);
      }, 0);
    }
    return product.price;
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Skeleton className="mb-4 h-10 w-32" />
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  const availableTiers = product.ticket_tiers?.filter((tier) => !tier.is_sold_out) || [];
  const hasSelectedTiers = Object.keys(selectedTiers).length > 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="relative aspect-square w-full overflow-hidden rounded-lg border">
            {product.cover_image ? (
              <SafeImage
                src={product.cover_image}
                alt={product.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-muted">
                <Ticket className="h-24 w-24 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary">{product.product_type.toUpperCase()}</Badge>
              {product.is_ticket_event && (
                <Badge variant="outline">
                  <Ticket className="mr-1 h-3 w-3" />
                  Event
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold">{product.title}</h1>
            <p className="mt-2 text-sm text-foreground/70">by {product.seller_name}</p>
          </div>

          <Separator />

          <div>
            <h2 className="mb-2 text-lg font-semibold">Description</h2>
            <p className="text-foreground/80 whitespace-pre-wrap">
              {product.description}
            </p>
          </div>

          {product.event_date && (
            <div>
              <h3 className="mb-1 text-sm font-medium">Event Date</h3>
              <p className="text-foreground/70">
                {new Date(product.event_date).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          )}

          {product.is_ticket_event && product.ticket_tiers && (
            <div>
              <h3 className="mb-3 text-lg font-semibold">Ticket Options</h3>
              <div className="space-y-3">
                {product.ticket_tiers.map((tier) => (
                  <Card
                    key={tier.id}
                    className={tier.is_sold_out ? "opacity-60" : ""}
                  >
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{tier.name}</h4>
                          {tier.is_sold_out && (
                            <Badge variant="destructive" className="text-xs">
                              Sold Out
                            </Badge>
                          )}
                        </div>
                        {tier.description && (
                          <p className="mt-1 text-sm text-foreground/70">
                            {tier.description}
                          </p>
                        )}
                        <p className="mt-1 text-lg font-semibold text-primary">
                          ₦{tier.price.toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs text-foreground/60">
                          {tier.remaining_quantity} available
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            {product.is_ticket_event ? (
              <>
                <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={handleAddToCart}
                      className="flex-1"
                      disabled={availableTiers.length === 0}
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Select Tickets
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Select Tickets</DialogTitle>
                      <DialogDescription>
                        Choose the ticket types and quantities you want to purchase
                      </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] space-y-4 overflow-y-auto">
                      {availableTiers.map((tier) => {
                        const quantity = selectedTiers[tier.id] || 0;
                        return (
                          <Card key={tier.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium">{tier.name}</h4>
                                  {tier.description && (
                                    <p className="mt-1 text-sm text-foreground/70">
                                      {tier.description}
                                    </p>
                                  )}
                                  {tier.benefits && (
                                    <p className="mt-1 text-xs text-foreground/60">
                                      Benefits: {tier.benefits}
                                    </p>
                                  )}
                                  <p className="mt-2 text-lg font-semibold text-primary">
                                    ₦{tier.price.toLocaleString()}
                                  </p>
                                  <p className="text-xs text-foreground/60">
                                    {tier.remaining_quantity} available
                                  </p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => updateTierQuantity(tier.id, -1)}
                                    disabled={quantity === 0}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <span className="w-8 text-center font-medium">
                                    {quantity}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => updateTierQuantity(tier.id, 1)}
                                    disabled={quantity >= tier.remaining_quantity}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t pt-4">
                      <div>
                        <p className="text-sm text-foreground/70">Total</p>
                        <p className="text-2xl font-bold text-primary">
                          ₦{getTotalPrice().toLocaleString()}
                        </p>
                      </div>
                      <Button
                        onClick={handleAddSelectedTiersToCart}
                        disabled={!hasSelectedTiers}
                      >
                        Add to Cart
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <Button onClick={handleAddToCart} className="flex-1">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Add to Cart - ₦{product.price.toLocaleString()}
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/cart">View Cart</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


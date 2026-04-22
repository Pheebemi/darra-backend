"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SafeImage } from "@/components/safe-image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Plus,
  Minus,
  ShoppingCart,
  Calendar,
  User,
  Shield,
  Zap,
  CheckCircle,
  ShoppingBag,
  Package,
} from "lucide-react";
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
    if (params.id) fetchProduct();
  }, [params.id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/products/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch product");
      setProduct(await response.json());
    } catch (error: any) {
      toast.error(error.message || "Failed to load product");
      router.push("/products");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (product.seller_id === user?.id) {
      toast.error("You cannot add your own product to the cart.");
      return;
    }
    if (product.is_ticket_event && product.ticket_tiers && product.ticket_tiers.length > 0) {
      const available = product.ticket_tiers.filter((t) => !t.is_sold_out);
      if (available.length === 0) { toast.error("All tickets are sold out."); return; }
      setShowTicketModal(true);
    } else {
      handleAddToCartClick(product.id);
      toast.success("Added to cart!");
    }
  };

  const handleAddToCartClick = (productId: number, tierId?: number, quantity = 1) => {
    if (!product) return;
    const tier = tierId ? product.ticket_tiers?.find((t) => t.id === tierId) : undefined;
    addItem(
      productId,
      tierId,
      quantity,
      { id: product.id, title: product.title, price: product.price, cover_image: product.cover_image, product_type: product.product_type, is_ticket_event: product.is_ticket_event },
      tier ? { id: tier.id, name: tier.name, price: tier.price } : undefined
    );
  };

  const updateTierQuantity = (tierId: number, delta: number) => {
    const tier = product?.ticket_tiers?.find((t) => t.id === tierId);
    if (!tier) return;
    const current = selectedTiers[tierId] || 0;
    const next = Math.max(0, Math.min(tier.remaining_quantity, current + delta));
    if (next === 0) {
      const { [tierId]: _, ...rest } = selectedTiers;
      setSelectedTiers(rest);
    } else {
      setSelectedTiers({ ...selectedTiers, [tierId]: next });
    }
  };

  const handleAddSelectedTiersToCart = () => {
    const ids = Object.keys(selectedTiers).map(Number);
    if (ids.length === 0) { toast.error("Please select at least one ticket."); return; }
    ids.forEach((tierId) => {
      const qty = selectedTiers[tierId];
      if (qty > 0) handleAddToCartClick(product!.id, tierId, qty);
    });
    setShowTicketModal(false);
    setSelectedTiers({});
    toast.success("Added to cart!");
  };

  const getTotalPrice = () => {
    if (!product) return 0;
    if (product.is_ticket_event && Object.keys(selectedTiers).length > 0) {
      return Object.entries(selectedTiers).reduce((total, [tierId, qty]) => {
        const tier = product.ticket_tiers?.find((t) => t.id === Number(tierId));
        return total + (tier ? tier.price * qty : 0);
      }, 0);
    }
    return product.price;
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="mb-8 h-8 w-28" />
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const availableTiers = product.ticket_tiers?.filter((t) => !t.is_sold_out) || [];
  const hasSelectedTiers = Object.keys(selectedTiers).length > 0;
  const totalSelectedTickets = Object.values(selectedTiers).reduce((s, q) => s + q, 0);
  const typeLabel = product.product_type
    ? product.product_type.charAt(0).toUpperCase() + product.product_type.slice(1).toLowerCase()
    : "Digital";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

      {/* Back */}
      <button
        onClick={() => router.back()}
        className="group mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Back
      </button>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Left — image */}
        <div className="space-y-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted">
            {product.cover_image ? (
              <SafeImage src={product.cover_image} alt={product.title} fill className="object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <Package className="h-14 w-14 text-muted-foreground/30" />
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground/40">{typeLabel}</span>
              </div>
            )}
            <span className="absolute left-3 top-3 rounded-md bg-background/80 px-2 py-0.5 text-xs font-medium backdrop-blur-sm">
              {typeLabel}
            </span>
          </div>

          {/* Trust row */}
          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-card p-3">
            {[
              { icon: Shield, label: "Secure", color: "text-emerald-500" },
              { icon: Zap, label: "Instant", color: "text-primary" },
              { icon: CheckCircle, label: "Verified", color: "text-emerald-500" },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex flex-col items-center gap-1 text-center">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — details */}
        <div className="space-y-4">
          {/* Main info */}
          <div className="rounded-lg border bg-card p-5">
            <h1 className="mb-1 text-xl font-semibold">{product.title}</h1>
            <div className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>by {product.seller_name}</span>
            </div>

            <Separator className="my-4" />

            <h2 className="mb-2 text-sm font-medium">
              {product.is_ticket_event ? "About this event" : "About this product"}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {product.description}
            </p>

            {product.event_date && (
              <div className="mt-4 flex items-start gap-3 rounded-md border bg-primary/5 border-primary/20 p-3">
                <Calendar className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-primary">Event Date</p>
                  <p className="text-sm text-foreground">
                    {new Date(product.event_date).toLocaleDateString("en-US", {
                      weekday: "long", year: "numeric", month: "long", day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Ticket tiers (read-only display) */}
          {product.is_ticket_event && product.ticket_tiers && product.ticket_tiers.length > 0 && (
            <div className="rounded-lg border bg-card p-5">
              <h3 className="mb-3 text-sm font-medium">Available tiers</h3>
              <div className="space-y-2">
                {product.ticket_tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className={`rounded-md border p-3 ${
                      tier.is_sold_out ? "opacity-50 bg-muted/40" : "bg-background"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{tier.name}</p>
                        {tier.description && (
                          <p className="text-xs text-muted-foreground">{tier.description}</p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {tier.is_sold_out ? "Sold out" : `${tier.remaining_quantity} remaining`}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-primary">₦{tier.price.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="rounded-lg border bg-card p-5 space-y-2">
            {product.is_ticket_event ? (
              <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
                <DialogTrigger asChild>
                  <Button className="w-full" onClick={handleAddToCart} disabled={availableTiers.length === 0}>
                    <ShoppingCart className="mr-1.5 h-4 w-4" />
                    Select Tickets
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Select Tickets</DialogTitle>
                    <DialogDescription>Choose quantities for {product.title}</DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[50vh] space-y-2 overflow-y-auto">
                    {availableTiers.map((tier) => {
                      const qty = selectedTiers[tier.id] || 0;
                      return (
                        <div key={tier.id} className="rounded-md border bg-background p-3">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="text-sm font-medium">{tier.name}</p>
                              {tier.description && (
                                <p className="text-xs text-muted-foreground">{tier.description}</p>
                              )}
                              <p className="mt-0.5 text-xs text-muted-foreground">{tier.remaining_quantity} available</p>
                            </div>
                            <p className="text-sm font-semibold text-primary">₦{tier.price.toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateTierQuantity(tier.id, -1)}
                              disabled={qty === 0}
                              className="flex h-7 w-7 items-center justify-center rounded border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-7 text-center text-sm font-medium">{qty}</span>
                            <button
                              onClick={() => updateTierQuantity(tier.id, 1)}
                              disabled={qty >= tier.remaining_quantity}
                              className="flex h-7 w-7 items-center justify-center rounded border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between border-t pt-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {totalSelectedTickets} ticket{totalSelectedTickets !== 1 ? "s" : ""} selected
                      </p>
                      <p className="text-lg font-semibold">₦{getTotalPrice().toLocaleString()}</p>
                    </div>
                    <Button onClick={handleAddSelectedTiersToCart} disabled={!hasSelectedTiers} size="sm">
                      Add to Cart
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <Button className="w-full" onClick={handleAddToCart}>
                <ShoppingCart className="mr-1.5 h-4 w-4" />
                Add to Cart — ₦{product.price.toLocaleString()}
              </Button>
            )}
            <Button variant="outline" className="w-full" asChild>
              <Link href="/cart">View Cart</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

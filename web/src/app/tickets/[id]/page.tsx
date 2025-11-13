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
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Ticket, 
  Plus, 
  Minus, 
  ShoppingCart, 
  Calendar,
  User,
  MapPin,
  Clock,
  Shield,
  Zap,
  CheckCircle
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

    if (product.seller_id === user?.id) {
      toast.error("You cannot add your own product to the cart.");
      return;
    }

    if (product.is_ticket_event && product.ticket_tiers && product.ticket_tiers.length > 0) {
      const availableTiers = product.ticket_tiers.filter((tier) => !tier.is_sold_out);
      if (availableTiers.length === 0) {
        toast.error("All tickets for this event are sold out.");
        return;
      }
      setShowTicketModal(true);
    } else {
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-900">
        <div className="absolute inset-0 bg-grid-slate-900/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-400/10 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />
        <div className="relative mx-auto max-w-6xl px-6 py-8">
          <Skeleton className="mb-6 h-10 w-32 rounded-xl" />
          <div className="grid gap-8 md:grid-cols-2">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <div className="space-y-6">
              <Skeleton className="h-8 w-3/4 rounded-xl" />
              <Skeleton className="h-4 w-full rounded-xl" />
              <Skeleton className="h-4 w-2/3 rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
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
  const totalSelectedTickets = Object.values(selectedTiers).reduce((sum, qty) => sum + qty, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-900">
      <div className="absolute inset-0 bg-grid-slate-900/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-400/10 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />
      
      <div className="relative mx-auto max-w-6xl px-6 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="group mb-8 rounded-xl border-slate-200/50 bg-white/80 backdrop-blur-xl hover:bg-white dark:border-slate-700/50 dark:bg-slate-800/80 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Events
        </Button>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Image Section */}
          <div className="space-y-4">
            <div className="group relative aspect-square w-full overflow-hidden rounded-2xl border-2 border-slate-200/50 bg-white/80 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/80">
              {product.cover_image ? (
                <SafeImage
                  src={product.cover_image}
                  alt={product.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                  <Ticket className="h-24 w-24 text-blue-400/30" />
                </div>
              )}
              <div className="absolute top-4 left-4 flex gap-2">
                <Badge className="rounded-full bg-white/90 backdrop-blur-sm text-slate-700 border-none shadow-lg dark:bg-slate-800/90 dark:text-slate-300">
                  {product.product_type.toUpperCase()}
                </Badge>
                {product.is_ticket_event && (
                  <Badge className="rounded-full bg-blue-100 text-blue-700 border-none shadow-lg dark:bg-blue-900/30 dark:text-blue-300">
                    <Ticket className="mr-1 h-3 w-3" />
                    Event
                  </Badge>
                )}
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-200/50 bg-white/80 p-4 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/80">
              <div className="flex flex-col items-center text-center">
                <Shield className="h-5 w-5 text-green-600 mb-1" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Secure</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <Zap className="h-5 w-5 text-blue-600 mb-1" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Instant</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <CheckCircle className="h-5 w-5 text-purple-600 mb-1" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Verified</span>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200/50 bg-white/80 p-6 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/80">
              <div className="mb-4">
                <h1 className="text-3xl font-bold bg-gradient-to-br from-slate-900 to-blue-700 dark:from-slate-100 dark:to-blue-400 bg-clip-text text-transparent">
                  {product.title}
                </h1>
                <div className="mt-2 flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <User className="h-4 w-4" />
                  <span>by {product.seller_name}</span>
                </div>
              </div>

              <Separator className="my-4 bg-slate-200/50 dark:bg-slate-700/50" />

              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">About this event</h2>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>

              {/* Event Details */}
              {product.event_date && (
                <div className="mt-6 space-y-3 rounded-xl bg-blue-50/50 p-4 dark:bg-blue-900/20">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">Event Date</p>
                      <p className="text-slate-600 dark:text-slate-300">
                        {new Date(product.event_date).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Ticket Options */}
              {product.is_ticket_event && product.ticket_tiers && (
                <div className="mt-6">
                  <h3 className="mb-4 text-xl font-semibold text-slate-900 dark:text-white">Available Tickets</h3>
                  <div className="space-y-3">
                    {product.ticket_tiers.map((tier) => (
                      <Card
                        key={tier.id}
                        className={`rounded-xl border-2 transition-all hover:shadow-lg ${
                          tier.is_sold_out 
                            ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20" 
                            : "border-slate-200/50 bg-white/50 dark:border-slate-700/50 dark:bg-slate-800/50"
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-slate-900 dark:text-white">{tier.name}</h4>
                                {tier.is_sold_out && (
                                  <Badge variant="destructive" className="rounded-full">
                                    Sold Out
                                  </Badge>
                                )}
                              </div>
                              {tier.description && (
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                  {tier.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4">
                                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                  ₦{tier.price.toLocaleString()}
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-500">
                                  {tier.remaining_quantity} remaining
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="rounded-2xl border border-slate-200/50 bg-white/80 p-6 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/80">
              <div className="flex flex-col gap-4">
                {product.is_ticket_event ? (
                  <>
                    <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
                      <DialogTrigger asChild>
                        <Button
                          onClick={handleAddToCart}
                          className="rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 py-3 text-base font-semibold shadow-lg transition-all hover:from-blue-700 hover:to-purple-700 hover:shadow-xl disabled:opacity-50"
                          disabled={availableTiers.length === 0}
                          size="lg"
                        >
                          <ShoppingCart className="mr-2 h-5 w-5" />
                          Select Tickets
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl rounded-2xl border-slate-200/50 bg-white/80 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/80">
                        <DialogHeader className="text-center">
                          <DialogTitle className="text-2xl font-bold bg-gradient-to-br from-slate-900 to-blue-700 dark:from-slate-100 dark:to-blue-400 bg-clip-text text-transparent">
                            Select Your Tickets
                          </DialogTitle>
                          <DialogDescription className="text-slate-600 dark:text-slate-400 text-lg">
                            Choose the ticket types and quantities for {product.title}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
                          {availableTiers.map((tier) => {
                            const quantity = selectedTiers[tier.id] || 0;
                            return (
                              <Card key={tier.id} className="rounded-xl border-slate-200/50 bg-white/50 dark:border-slate-700/50 dark:bg-slate-800/50">
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-start justify-between mb-3">
                                        <div>
                                          <h4 className="font-semibold text-slate-900 dark:text-white">{tier.name}</h4>
                                          {tier.description && (
                                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                              {tier.description}
                                            </p>
                                          )}
                                        </div>
                                        <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                          ₦{tier.price.toLocaleString()}
                                        </p>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <p className="text-sm text-slate-500 dark:text-slate-500">
                                          {tier.remaining_quantity} tickets available
                                        </p>
                                        <div className="flex items-center gap-3">
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => updateTierQuantity(tier.id, -1)}
                                            disabled={quantity === 0}
                                            className="rounded-xl border-slate-300 dark:border-slate-600"
                                          >
                                            <Minus className="h-4 w-4" />
                                          </Button>
                                          <span className="w-8 text-center font-semibold text-slate-900 dark:text-white">
                                            {quantity}
                                          </span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => updateTierQuantity(tier.id, 1)}
                                            disabled={quantity >= tier.remaining_quantity}
                                            className="rounded-xl border-slate-300 dark:border-slate-600"
                                          >
                                            <Plus className="h-4 w-4" />
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
                        <div className="mt-6 flex items-center justify-between border-t border-slate-200/50 pt-6 dark:border-slate-700/50">
                          <div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Total ({totalSelectedTickets} tickets)</p>
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                              ₦{getTotalPrice().toLocaleString()}
                            </p>
                          </div>
                          <Button
                            onClick={handleAddSelectedTiersToCart}
                            disabled={!hasSelectedTiers}
                            className="rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 px-8 py-2 font-semibold hover:from-blue-700 hover:to-purple-700"
                            size="lg"
                          >
                            Add to Cart
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                ) : (
                  <Button 
                    onClick={handleAddToCart}
                    className="rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 py-3 text-base font-semibold shadow-lg transition-all hover:from-blue-700 hover:to-purple-700 hover:shadow-xl"
                    size="lg"
                  >
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Add to Cart - ₦{product.price.toLocaleString()}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  asChild
                  className="rounded-xl border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                  size="lg"
                >
                  <Link href="/cart">View Cart</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
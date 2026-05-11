"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SafeImage } from "@/components/safe-image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Plus,
  Minus,
  ShoppingCart,
  Calendar,
  Clock,
  MapPin,
  User,
  Shield,
  Zap,
  CheckCircle,
  Package,
  Mic2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-context";
import { useCart } from "@/lib/cart/cart-context";
import { getImageUrl } from "@/lib/utils";

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
  cover_image_url?: string;
  file?: string;
  created_at: string;
  event_date?: string;
  event_end_date?: string;
  venue_name?: string;
  location?: string;
  speakers?: string;
  ticket_tiers?: TicketTier[];
  is_ticket_event?: boolean;
  seller_name: string;
  seller_id: number;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

export default function ProductDetailClient({ product }: { product: Product }) {
  const router = useRouter();
  const { user } = useAuth();
  const { addItem } = useCart();
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedTiers, setSelectedTiers] = useState<Record<number, number>>({});

  const isEvent = product.product_type === "event";
  const [mapCoords, setMapCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!isEvent || (!product.location && !product.venue_name)) return;
    const query = [product.venue_name, product.location].filter(Boolean).join(", ");
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
      headers: { "Accept-Language": "en" },
    })
      .then(r => r.json())
      .then(data => {
        if (data?.[0]) setMapCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
      })
      .catch(() => {});
  }, [isEvent, product.location, product.venue_name]);
  const availableTiers = product.ticket_tiers?.filter((t) => !t.is_sold_out) || [];
  const hasSelectedTiers = Object.keys(selectedTiers).length > 0;
  const totalSelectedTickets = Object.values(selectedTiers).reduce((s, q) => s + q, 0);

  const coverSrc = product.cover_image_url
    ? getImageUrl(product.cover_image_url)
    : product.cover_image
    ? getImageUrl(product.cover_image)
    : null;

  const handleAddToCart = () => {
    if (!product) return;
    if (product.seller_id === user?.id) {
      toast.error("You cannot add your own product to the cart.");
      return;
    }
    if (product.is_ticket_event && product.ticket_tiers && product.ticket_tiers.length > 0) {
      if (availableTiers.length === 0) { toast.error("All tickets are sold out."); return; }
      setShowTicketModal(true);
    } else {
      addItem(
        product.id, undefined, 1,
        { id: product.id, title: product.title, price: product.price, cover_image: product.cover_image, product_type: product.product_type, is_ticket_event: product.is_ticket_event },
        undefined
      );
      toast.success("Added to cart!");
    }
  };

  const handleAddToCartClick = (productId: number, tierId?: number, quantity = 1) => {
    const tier = tierId ? product.ticket_tiers?.find((t) => t.id === tierId) : undefined;
    addItem(
      productId, tierId, quantity,
      { id: product.id, title: product.title, price: product.price, cover_image: product.cover_image, product_type: product.product_type, is_ticket_event: product.is_ticket_event },
      tier ? { id: tier.id, name: tier.name, price: tier.price } : undefined
    );
  };

  const updateTierQuantity = (tierId: number, delta: number) => {
    const tier = product.ticket_tiers?.find((t) => t.id === tierId);
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
      if (qty > 0) handleAddToCartClick(product.id, tierId, qty);
    });
    setShowTicketModal(false);
    setSelectedTiers({});
    toast.success("Added to cart!");
  };

  const getTotalPrice = () => {
    if (product.is_ticket_event && Object.keys(selectedTiers).length > 0) {
      return Object.entries(selectedTiers).reduce((total, [tierId, qty]) => {
        const tier = product.ticket_tiers?.find((t) => t.id === Number(tierId));
        return total + (tier ? tier.price * qty : 0);
      }, 0);
    }
    return product.price;
  };

  const speakers = product.speakers
    ? product.speakers.split("\n").map(s => s.trim()).filter(Boolean)
    : [];

  const osmUrl = product.location
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(
        [product.venue_name, product.location].filter(Boolean).join(", ")
      )}`
    : null;

  // ── EVENT LAYOUT ──────────────────────────────────────────────────────────
  if (isEvent) {
    return (
      <div className="min-h-screen bg-background">
        {/* Hero */}
        <div className="relative h-64 w-full overflow-hidden bg-[#3800ff]/10 sm:h-80">
          {coverSrc ? (
            <img src={coverSrc} alt={product.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-linear-to-br from-[#3800ff] to-[#7c3aed]">
              <Package className="h-16 w-16 text-white/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <Badge className="mb-2 bg-[#3800ff] text-white text-xs uppercase tracking-wider">Event</Badge>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">{product.title}</h1>
            <p className="mt-1 text-sm text-white/80">by {product.seller_name}</p>
          </div>
          <button
            onClick={() => router.back()}
            className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-sm text-white backdrop-blur-sm hover:bg-black/60"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>

        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-3">

            {/* Left col — details */}
            <div className="space-y-5 lg:col-span-2">

              {/* Date & Time */}
              {product.event_date && (
                <div className="rounded-xl border bg-card p-5">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Date & Time</h2>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-[#3800ff]/10 text-[#3800ff]">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{fmtDate(product.event_date)}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3.5 w-3.5" />
                        {fmtTime(product.event_date)}
                        {product.event_end_date && ` – ${fmtTime(product.event_end_date)}`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Location */}
              {(product.venue_name || product.location) && (
                <div className="rounded-xl border bg-card p-5">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Location</h2>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#3800ff]/10 text-[#3800ff]">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      {product.venue_name && <p className="font-medium">{product.venue_name}</p>}
                      {product.location && <p className="text-sm text-muted-foreground mt-0.5">{product.location}</p>}
                    </div>
                  </div>
                  {/* OSM map embed */}
                  {(product.location || product.venue_name) && (
                    <div className="mt-4 overflow-hidden rounded-lg border">
                      {mapCoords ? (
                        <>
                          <iframe
                            title="Event location map"
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapCoords.lon - 0.01},${mapCoords.lat - 0.01},${mapCoords.lon + 0.01},${mapCoords.lat + 0.01}&layer=mapnik&marker=${mapCoords.lat},${mapCoords.lon}`}
                            className="h-48 w-full"
                            loading="lazy"
                          />
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${mapCoords.lat}&mlon=${mapCoords.lon}#map=15/${mapCoords.lat}/${mapCoords.lon}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 bg-muted py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" /> View larger map
                          </a>
                        </>
                      ) : (
                        <a
                          href={osmUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-24 w-full items-center justify-center gap-2 bg-[#e8deff] text-[#3800ff] hover:bg-[#d4c9ff] transition-colors text-sm font-medium"
                        >
                          <MapPin className="h-4 w-4" />
                          View on OpenStreetMap
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* About */}
              <div className="rounded-xl border bg-card p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">About this event</h2>
                {product.description_html ? (
                  <div
                    className="text-sm text-muted-foreground leading-relaxed [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:mb-2"
                    dangerouslySetInnerHTML={{ __html: product.description_html }}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{product.description}</p>
                )}
              </div>

              {/* Speakers */}
              {speakers.length > 0 && (
                <div className="rounded-xl border bg-card p-5">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Speakers</h2>
                  <div className="space-y-2">
                    {speakers.map((s, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3800ff]/10">
                          <Mic2 className="h-4 w-4 text-[#3800ff]" />
                        </div>
                        <span className="text-sm font-medium">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right col — CTA */}
            <div className="space-y-4">
              {/* Ticket tiers */}
              {product.ticket_tiers && product.ticket_tiers.length > 0 && (
                <div className="rounded-xl border bg-card p-5">
                  <h3 className="mb-3 text-sm font-semibold">Tickets</h3>
                  <div className="space-y-2">
                    {product.ticket_tiers.map((tier) => (
                      <div
                        key={tier.id}
                        className={`rounded-lg border p-3 ${tier.is_sold_out ? "opacity-50 bg-muted/40" : "bg-background"}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium">{tier.category?.name || tier.name}</p>
                            {tier.description && tier.description !== `${tier.category?.name} tickets` && (
                              <p className="text-xs text-muted-foreground">{tier.description}</p>
                            )}
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {tier.is_sold_out ? "Sold out" : `${tier.remaining_quantity} left`}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-[#3800ff]">₦{Number(tier.price).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Buy */}
              <div className="rounded-xl border bg-card p-5 space-y-2">
                <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
                  <Button
                    className="w-full bg-[#3800ff] text-white hover:bg-[#2d00d4]"
                    onClick={handleAddToCart}
                    disabled={product.is_ticket_event && availableTiers.length === 0}
                  >
                    <ShoppingCart className="mr-1.5 h-4 w-4" />
                    {product.is_ticket_event ? "Get Tickets" : `Add to Cart — ₦${Number(product.price).toLocaleString()}`}
                  </Button>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Select Tickets</DialogTitle>
                      <DialogDescription>Choose quantities for {product.title}</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[50vh] space-y-2 overflow-y-auto">
                      {availableTiers.map((tier) => {
                        const qty = selectedTiers[tier.id] || 0;
                        return (
                          <div key={tier.id} className="rounded-lg border bg-background p-3">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="text-sm font-medium">{tier.category?.name || tier.name}</p>
                                {tier.description && tier.description !== `${tier.category?.name} tickets` && (
                                  <p className="text-xs text-muted-foreground">{tier.description}</p>
                                )}
                                <p className="mt-0.5 text-xs text-muted-foreground">{tier.remaining_quantity} available</p>
                              </div>
                              <p className="text-sm font-bold text-[#3800ff]">₦{Number(tier.price).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => updateTierQuantity(tier.id, -1)} disabled={qty === 0}
                                className="flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:border-[#3800ff] hover:text-[#3800ff] disabled:opacity-40">
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-7 text-center text-sm font-medium">{qty}</span>
                              <button onClick={() => updateTierQuantity(tier.id, 1)} disabled={qty >= tier.remaining_quantity}
                                className="flex h-7 w-7 items-center justify-center rounded border text-muted-foreground hover:border-[#3800ff] hover:text-[#3800ff] disabled:opacity-40">
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between border-t pt-4">
                      <div>
                        <p className="text-xs text-muted-foreground">{totalSelectedTickets} ticket{totalSelectedTickets !== 1 ? "s" : ""} selected</p>
                        <p className="text-lg font-bold">₦{getTotalPrice().toLocaleString()}</p>
                      </div>
                      <Button onClick={handleAddSelectedTiersToCart} disabled={!hasSelectedTiers}
                        className="bg-[#3800ff] text-white hover:bg-[#2d00d4]" size="sm">
                        Add to Cart
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/cart">View Cart</Link>
                </Button>
              </div>

              {/* Trust */}
              <div className="grid grid-cols-3 gap-2 rounded-xl border bg-card p-3">
                {[
                  { icon: Shield, label: "Secure", color: "text-emerald-500" },
                  { icon: Zap, label: "Instant", color: "text-[#3800ff]" },
                  { icon: CheckCircle, label: "Verified", color: "text-emerald-500" },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex flex-col items-center gap-1 text-center">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── DIGITAL PRODUCT LAYOUT ────────────────────────────────────────────────
  const typeLabel = product.product_type
    ? product.product_type.charAt(0).toUpperCase() + product.product_type.slice(1)
    : "Digital";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        onClick={() => router.back()}
        className="group mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Back
      </button>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-muted">
            {coverSrc ? (
              <img src={coverSrc} alt={product.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <Package className="h-14 w-14 text-muted-foreground/30" />
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground/40">{typeLabel}</span>
              </div>
            )}
            <span className="absolute left-3 top-3 rounded-md bg-background/80 px-2 py-0.5 text-xs font-medium backdrop-blur-sm">{typeLabel}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-xl border bg-card p-3">
            {[
              { icon: Shield, label: "Secure", color: "text-emerald-500" },
              { icon: Zap, label: "Instant", color: "text-[#3800ff]" },
              { icon: CheckCircle, label: "Verified", color: "text-emerald-500" },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex flex-col items-center gap-1 text-center">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <h1 className="mb-1 text-xl font-semibold">{product.title}</h1>
            <div className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>by {product.seller_name}</span>
            </div>
            <Separator className="my-4" />
            <h2 className="mb-2 text-sm font-medium">About this product</h2>
            {product.description_html ? (
              <div
                className="text-sm text-muted-foreground leading-relaxed [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:mb-2"
                dangerouslySetInnerHTML={{ __html: product.description_html }}
              />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{product.description}</p>
            )}
          </div>

          <div className="rounded-xl border bg-card p-5 space-y-2">
            <Button className="w-full bg-[#3800ff] text-white hover:bg-[#2d00d4]" onClick={handleAddToCart}>
              <ShoppingCart className="mr-1.5 h-4 w-4" />
              Add to Cart — ₦{Number(product.price).toLocaleString()}
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/cart">View Cart</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

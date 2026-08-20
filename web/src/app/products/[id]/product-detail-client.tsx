"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  Share2,
  Hourglass,
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
  display_name?: string;
  color?: string;
  category?: { name?: string };
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

const fmtDatePill = (s: string) =>
  new Date(s).toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" });

// Live countdown to the event. Renders nothing until mounted to avoid an
// SSR/hydration mismatch, then updates every minute.
function EventCountdown({ start, end }: { start: string; end?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;

  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : startMs;

  if (now >= startMs && now <= endMs) {
    return (
      <div className="flex items-center justify-center gap-2 bg-[#00B42A]/10 py-3 text-sm font-semibold text-ok">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#00B42A]" /> Happening now
      </div>
    );
  }
  if (now > endMs) {
    return (
      <div className="flex items-center justify-center gap-2 bg-inset py-3 text-sm font-medium text-subtle">
        This event has ended
      </div>
    );
  }
  const diff = startMs - now;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const parts = d > 0 ? [`${d}d`, `${h}h`] : h > 0 ? [`${h}h`, `${m}m`] : [`${m}m`];
  return (
    <div className="flex items-center justify-center gap-2 bg-brand-soft py-3 text-sm font-semibold text-brand-700">
      <Hourglass className="h-4 w-4" /> Starts in {parts.join(" ")}
    </div>
  );
}

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

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const shareData = { title: product.title, text: `Check out ${product.title} on Darra`, url };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    } else if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(url); toast.success("Link copied to clipboard!"); } catch {}
    }
  };

  const handleAddToCartClick = (productId: number, tierId?: number, quantity = 1) => {
    const tier = tierId ? product.ticket_tiers?.find((t) => t.id === tierId) : undefined;
    addItem(
      productId, tierId, quantity,
      { id: product.id, title: product.title, price: product.price, cover_image: product.cover_image, product_type: product.product_type, is_ticket_event: product.is_ticket_event },
      tier ? { id: tier.id, name: tier.display_name || tier.name, price: tier.price } : undefined
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
      <div className="min-h-screen bg-page">
        {/* Hero */}
        <div className="relative h-64 w-full overflow-hidden bg-brand-950 sm:h-80">
          {coverSrc ? (
            <img src={coverSrc} alt={product.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Package className="h-16 w-16 text-accent-link/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-dark/80 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-block rounded-full bg-brand-500 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white">
                Event
              </span>
              {product.event_date && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  <Calendar className="h-3.5 w-3.5" />
                  {fmtDatePill(product.event_date)} · {fmtTime(product.event_date)}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">{product.title}</h1>
            <p className="mt-1 text-sm text-brand-100">by {product.seller_name}</p>
          </div>
          <button
            onClick={() => router.back()}
            className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-ink/50 px-4 py-2 text-sm text-white backdrop-blur-sm transition-colors hover:bg-ink/70"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={handleShare}
            className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-ink/50 px-4 py-2 text-sm text-white backdrop-blur-sm transition-colors hover:bg-ink/70"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>

        {product.event_date && (
          <EventCountdown start={product.event_date} end={product.event_end_date} />
        )}

        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-16">
          <div className="grid gap-6 lg:grid-cols-3">

            {/* Left col — details */}
            <div className="space-y-6 lg:col-span-2">

              {/* Date & Time */}
              {product.event_date && (
                <div className="rounded-3xl border border-line bg-surface p-6">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent-link">Date & Time</h2>
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-softer text-accent-link">
                      <span className="text-[10px] font-semibold uppercase leading-none">
                        {new Date(product.event_date).toLocaleDateString("en-NG", { month: "short" })}
                      </span>
                      <span className="text-xl font-bold leading-tight">
                        {new Date(product.event_date).getDate()}
                      </span>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-strong">{fmtDate(product.event_date)}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-body">
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
                <div className="rounded-3xl border border-line bg-surface p-6">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent-link">Location</h2>
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-softer text-accent-link">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      {product.venue_name && <p className="font-medium text-strong">{product.venue_name}</p>}
                      {product.location && <p className="mt-0.5 text-sm text-body">{product.location}</p>}
                    </div>
                  </div>
                  {/* OSM map embed */}
                  {(product.location || product.venue_name) && (
                    <div className="mt-5 overflow-hidden rounded-2xl border border-line">
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
                            className="flex items-center justify-center gap-1.5 bg-brand-soft py-2 text-xs text-body transition-colors hover:text-accent-link"
                          >
                            <ExternalLink className="h-3 w-3" /> View larger map
                          </a>
                        </>
                      ) : (
                        <a
                          href={osmUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-24 w-full items-center justify-center gap-2 bg-brand-softer text-sm font-medium text-accent-link transition-colors hover:bg-brand-200"
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
              <div className="rounded-3xl border border-line bg-surface p-6">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent-link">About this event</h2>
                {product.description_html ? (
                  <div
                    className="text-sm leading-relaxed text-body [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_p]:mb-2"
                    dangerouslySetInnerHTML={{ __html: product.description_html }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-body">{product.description}</p>
                )}
              </div>

              {/* Speakers */}
              {speakers.length > 0 && (
                <div className="rounded-3xl border border-line bg-surface p-6">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent-link">Speakers</h2>
                  <div className="space-y-3">
                    {speakers.map((s, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-softer">
                          <Mic2 className="h-4 w-4 text-accent-link" />
                        </div>
                        <span className="text-sm font-medium text-strong">{s}</span>
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
                <div className="rounded-3xl border border-line bg-surface p-6">
                  <h3 className="mb-4 text-lg font-semibold text-ink">Tickets</h3>
                  <div className="space-y-2">
                    {product.ticket_tiers.map((tier) => (
                      <div
                        key={tier.id}
                        className={`rounded-2xl border p-4 ${tier.is_sold_out ? "border-line bg-inset opacity-50" : "border-line bg-page-soft"}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-strong">{tier.display_name || tier.name}</p>
                            {tier.description && (
                              <p className="text-xs text-body">{tier.description}</p>
                            )}
                            <p className="mt-0.5 text-xs text-body">
                              {tier.is_sold_out ? "Sold out" : `${tier.remaining_quantity} left`}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-accent-link">₦{Number(tier.price).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Buy */}
              <div className="space-y-2 rounded-3xl border border-line bg-surface p-6">
                <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
                  <Button
                    className="w-full rounded-full bg-brand-500 py-6 text-white hover:bg-brand-600 focus-visible:ring-brand-300 active:bg-brand-700"
                    onClick={handleAddToCart}
                    disabled={product.is_ticket_event && availableTiers.length === 0}
                  >
                    <ShoppingCart className="mr-1.5 h-4 w-4" />
                    {product.is_ticket_event ? "Get Tickets" : `Add to Cart — ₦${Number(product.price).toLocaleString()}`}
                  </Button>
                  <DialogContent className="max-w-md rounded-3xl">
                    <DialogHeader>
                      <DialogTitle className="text-ink">Select Tickets</DialogTitle>
                      <DialogDescription>Choose quantities for {product.title}</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[50vh] space-y-2 overflow-y-auto">
                      {availableTiers.map((tier) => {
                        const qty = selectedTiers[tier.id] || 0;
                        return (
                          <div key={tier.id} className="rounded-2xl border border-line bg-page-soft p-4">
                            <div className="mb-3 flex items-start justify-between">
                              <div>
                                <p className="text-sm font-medium text-strong">{tier.display_name || tier.name}</p>
                                {tier.description && (
                                  <p className="text-xs text-body">{tier.description}</p>
                                )}
                                <p className="mt-0.5 text-xs text-body">{tier.remaining_quantity} available</p>
                              </div>
                              <p className="text-sm font-bold text-accent-link">₦{Number(tier.price).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => updateTierQuantity(tier.id, -1)} disabled={qty === 0}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-body transition-colors hover:border-brand-500 hover:text-accent-link disabled:opacity-40">
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-7 text-center text-sm font-medium">{qty}</span>
                              <button onClick={() => updateTierQuantity(tier.id, 1)} disabled={qty >= tier.remaining_quantity}
                                className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-body transition-colors hover:border-brand-500 hover:text-accent-link disabled:opacity-40">
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between border-t border-line pt-4">
                      <div>
                        <p className="text-xs text-body">{totalSelectedTickets} ticket{totalSelectedTickets !== 1 ? "s" : ""} selected</p>
                        <p className="text-lg font-bold text-ink">₦{getTotalPrice().toLocaleString()}</p>
                      </div>
                      <Button onClick={handleAddSelectedTiersToCart} disabled={!hasSelectedTiers}
                        className="rounded-full bg-brand-500 text-white hover:bg-brand-600" size="sm">
                        Add to Cart
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" className="w-full rounded-full border-brand-500 text-accent-link hover:bg-brand-500 hover:text-white" asChild>
                  <Link href="/cart">View Cart</Link>
                </Button>
              </div>

              {/* Host + Share */}
              <div className="space-y-3 rounded-3xl border border-line bg-surface p-6">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-accent-link">Hosted by</h3>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-softer text-lg font-semibold text-accent-link">
                    {(product.seller_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-strong">{product.seller_name}</p>
                    <p className="text-xs text-subtle">Event organizer</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleShare}
                  className="w-full rounded-full border-line-strong text-body hover:border-brand-500 hover:text-accent-link"
                >
                  <Share2 className="mr-1.5 h-4 w-4" /> Share event
                </Button>
              </div>

              {/* Trust */}
              <div className="grid grid-cols-3 gap-2 rounded-3xl border border-line bg-surface p-4">
                {[
                  { icon: Shield, label: "Secure", color: "text-ok" },
                  { icon: Zap, label: "Instant", color: "text-accent-link" },
                  { icon: CheckCircle, label: "Verified", color: "text-ok" },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex flex-col items-center gap-1 text-center">
                    <Icon className={`h-4 w-4 ${color}`} />
                    <span className="text-xs text-body">{label}</span>
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
    <div className="min-h-screen bg-page">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-16">
        <button
          onClick={() => router.back()}
          className="group mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-body transition-colors hover:text-accent-link"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Back
        </button>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-line bg-brand-soft">
              {coverSrc ? (
                <img src={coverSrc} alt={product.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <Package className="h-14 w-14 text-brand-300" />
                  <span className="text-xs font-medium uppercase tracking-widest text-brand-400">{typeLabel}</span>
                </div>
              )}
              {/* Sits on the cover image, so the chip and its label flip
                  together — a literal white pill would hide light ink text. */}
              <span className="absolute left-4 top-4 rounded-full bg-surface/85 px-3 py-1 text-xs font-medium text-ink backdrop-blur-sm">{typeLabel}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-3xl border border-line bg-surface p-4">
              {[
                { icon: Shield, label: "Secure", color: "text-ok" },
                { icon: Zap, label: "Instant", color: "text-accent-link" },
                { icon: CheckCircle, label: "Verified", color: "text-ok" },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex flex-col items-center gap-1 text-center">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-xs text-body">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-line bg-surface p-6">
              <h1 className="mb-1 text-2xl font-semibold text-ink sm:text-3xl">{product.title}</h1>
              <div className="mb-4 flex items-center gap-1.5 text-sm text-body">
                <User className="h-3.5 w-3.5" />
                <span>by {product.seller_name}</span>
              </div>
              <Separator className="my-4" />
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent-link">About this product</h2>
              {product.description_html ? (
                <div
                  className="text-sm leading-relaxed text-body [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_p]:mb-2"
                  dangerouslySetInnerHTML={{ __html: product.description_html }}
                />
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-body">{product.description}</p>
              )}
            </div>

            <div className="space-y-2 rounded-3xl border border-line bg-surface p-6">
              <Button
                className="w-full rounded-full bg-brand-500 py-6 text-white hover:bg-brand-600 focus-visible:ring-brand-300 active:bg-brand-700"
                onClick={handleAddToCart}
              >
                <ShoppingCart className="mr-1.5 h-4 w-4" />
                Add to Cart — ₦{Number(product.price).toLocaleString()}
              </Button>
              <Button variant="outline" className="w-full rounded-full border-brand-500 text-accent-link hover:bg-brand-500 hover:text-white" asChild>
                <Link href="/cart">View Cart</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

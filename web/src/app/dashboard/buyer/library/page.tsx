"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SafeImage } from "@/components/safe-image";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  QrCode,
  Download,
  CheckCircle2,
  XCircle,
  Package,
  ShoppingBag,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { getImageUrl } from "@/lib/utils";

interface EventTicket {
  id: number;
  ticket_id: string;
  ticket_png_url: string | null;
  qr_code_url: string | null;
  is_used: boolean;
  created_at: string;
}

interface LibraryItem {
  id: number;
  product: {
    id: number;
    title: string;
    description: string;
    price: number;
    product_type: string;
    cover_image_url?: string;
    file_url?: string;
    created_at: string;
  };
  quantity: number;
  added_at: string;
  event_tickets?: EventTicket[];
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function BuyerLibraryPage() {
  const { isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "products" | "access">("all");

  useEffect(() => {
    if (initialized && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) fetchLibrary();
  }, [isAuthenticated]);

  const fetchLibrary = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/payments/library");
      if (!res.ok) throw new Error("Failed to fetch library");
      const data = await res.json();
      setItems(data.results || data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load library");
    } finally {
      setLoading(false);
    }
  };

  if (!initialized || !isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  const accessItems = items.filter((i) => i.product.product_type === "event" && i.event_tickets?.length);
  const downloadItems = items.filter((i) => i.product.product_type !== "event" || !i.event_tickets?.length);

  const displayed =
    filter === "access" ? accessItems :
    filter === "products" ? downloadItems :
    items;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">My Library</h1>
            <p className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? "item" : "items"} purchased
            </p>
          </div>
          <Button size="sm" asChild>
            <a href="/products">
              <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
              Browse
            </a>
          </Button>
        </div>

        {/* Filter tabs */}
        {!loading && items.length > 0 && (
          <div className="flex gap-1 border rounded-md p-0.5 w-fit">
            {([
              { key: "all", label: `All (${items.length})` },
              { key: "products", label: `Downloads (${downloadItems.length})` },
              { key: "access", label: `QR Access (${accessItems.length})` },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  filter === key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-52 w-full rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border bg-card py-14 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">Library is empty</p>
            <p className="text-xs text-muted-foreground">Products you purchase will appear here</p>
            <Button size="sm" className="mt-4 h-8 text-xs" asChild>
              <a href="/products">
                <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />Browse Products
              </a>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Download products */}
            {(filter === "all" || filter === "products") && downloadItems.map((item) => (
              <div key={item.id} className="rounded-lg border bg-card overflow-hidden flex flex-col">
                <div className="relative h-36 bg-muted shrink-0">
                  {item.product.cover_image_url ? (
                    <SafeImage
                      src={getImageUrl(item.product.cover_image_url)}
                      alt={item.product.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <p className="text-sm font-medium line-clamp-1">{item.product.title}</p>
                  {item.product.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.product.description}</p>
                  )}
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Purchased {fmtDate(item.added_at)}
                  </p>
                  <div className="mt-auto pt-3">
                    {item.product.file_url ? (
                      <Button size="sm" variant="outline" className="w-full h-8 text-xs" asChild>
                        <a href={item.product.file_url} download target="_blank" rel="noopener noreferrer">
                          <Download className="mr-1.5 h-3.5 w-3.5" />Download
                        </a>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="w-full h-8 text-xs" disabled>
                        No file attached
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* QR access tickets */}
            {(filter === "all" || filter === "access") && accessItems.map((item) =>
              item.event_tickets?.map((ticket) => (
                <div key={ticket.id} className="rounded-lg border bg-card overflow-hidden flex flex-col">
                  {/* QR preview */}
                  <div className="relative h-36 bg-muted/50 flex items-center justify-center shrink-0">
                    {ticket.qr_code_url ? (
                      <SafeImage
                        src={getImageUrl(ticket.qr_code_url)}
                        alt="QR Code"
                        width={100}
                        height={100}
                        className="object-contain"
                      />
                    ) : (
                      <QrCode className="h-12 w-12 text-muted-foreground/30" />
                    )}
                    {/* Status badge */}
                    <div className="absolute top-2 right-2">
                      <Badge
                        className={`text-[10px] px-1.5 h-5 gap-1 ${
                          ticket.is_used
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-emerald-500 text-white hover:bg-emerald-500"
                        }`}
                      >
                        {ticket.is_used
                          ? <><XCircle className="h-2.5 w-2.5" />Used</>
                          : <><CheckCircle2 className="h-2.5 w-2.5" />Valid</>
                        }
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-3">
                    <p className="text-sm font-medium line-clamp-1">{item.product.title}</p>
                    <div className="mt-0.5 flex items-center gap-1">
                      <Shield className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] font-mono text-muted-foreground truncate">{ticket.ticket_id}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Purchased {fmtDate(ticket.created_at)}
                    </p>

                    <div className="mt-auto pt-3">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="w-full h-8 text-xs">
                            <QrCode className="mr-1.5 h-3.5 w-3.5" />View Ticket
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm">
                          <DialogHeader>
                            <DialogTitle className="text-base">{item.product.title}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            {/* Ticket image or QR */}
                            <div className="rounded-lg border bg-muted/30 flex items-center justify-center p-4">
                              {ticket.ticket_png_url ? (
                                <SafeImage
                                  src={getImageUrl(ticket.ticket_png_url)}
                                  alt="Ticket"
                                  width={320}
                                  height={200}
                                  className="w-full h-auto object-contain rounded"
                                />
                              ) : ticket.qr_code_url ? (
                                <SafeImage
                                  src={getImageUrl(ticket.qr_code_url)}
                                  alt="QR Code"
                                  width={200}
                                  height={200}
                                  className="object-contain"
                                />
                              ) : (
                                <QrCode className="h-24 w-24 text-muted-foreground/30" />
                              )}
                            </div>

                            {/* Details */}
                            <div className="divide-y text-sm">
                              <div className="flex justify-between py-2">
                                <span className="text-muted-foreground">Ticket ID</span>
                                <span className="font-mono text-xs">{ticket.ticket_id}</span>
                              </div>
                              <div className="flex justify-between py-2">
                                <span className="text-muted-foreground">Status</span>
                                <Badge
                                  className={`text-[10px] px-1.5 h-5 ${
                                    ticket.is_used
                                      ? "bg-secondary text-secondary-foreground"
                                      : "bg-emerald-500 text-white hover:bg-emerald-500"
                                  }`}
                                >
                                  {ticket.is_used ? "Used" : "Valid"}
                                </Badge>
                              </div>
                              <div className="flex justify-between py-2">
                                <span className="text-muted-foreground">Purchased</span>
                                <span>{fmtDate(ticket.created_at)}</span>
                              </div>
                            </div>

                            {ticket.ticket_png_url && (
                              <Button size="sm" variant="outline" className="w-full h-8 text-xs" asChild>
                                <a href={ticket.ticket_png_url} download target="_blank" rel="noopener noreferrer">
                                  <Download className="mr-1.5 h-3.5 w-3.5" />Download Ticket
                                </a>
                              </Button>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

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
    has_file?: boolean;
    // Legacy field: older backends still send file_url. Kept only so the
    // Download button keeps working if the frontend deploys before the API.
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
  const [downloading, setDownloading] = useState<number | null>(null);

  const handleDownload = async (url: string, filename: string, id: number) => {
    setDownloading(id);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message || "Download failed");
        return;
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  };


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
      <div className="mx-auto max-w-5xl space-y-6 p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-500">Purchases</p>
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">My Library</h1>
            <p className="mt-1 text-sm text-gray-600">
              {items.length} {items.length === 1 ? "item" : "items"} purchased
            </p>
          </div>
          <Button asChild>
            <a href="/products">
              <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
              Browse
            </a>
          </Button>
        </div>

        {/* Filter tabs */}
        {!loading && items.length > 0 && (
          <div className="flex w-fit gap-1 rounded-full border border-gray-200 bg-white p-1">
            {([
              { key: "all", label: `All (${items.length})` },
              { key: "products", label: `Downloads (${downloadItems.length})` },
              { key: "access", label: `QR Access (${accessItems.length})` },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                  filter === key
                    ? "bg-brand-500 text-white"
                    : "text-gray-600 hover:text-brand-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-52 w-full rounded-3xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-brand-200 bg-white py-16 text-center">
            <img src="/illustrations/no-data.svg" alt="" className="mb-6 h-28 w-auto" />
            <p className="font-medium text-ink">Library is empty</p>
            <p className="mt-1 text-xs text-gray-600">Products you purchase will appear here</p>
            <Button size="sm" className="mt-5" asChild>
              <a href="/products">
                <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />Browse Products
              </a>
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Download products */}
            {(filter === "all" || filter === "products") && downloadItems.map((item) => (
              <div key={item.id} className="rounded-3xl border border-gray-100 bg-white overflow-hidden flex flex-col">
                <div className="relative h-36 shrink-0 bg-brand-50">
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
                    {(item.product.has_file ?? Boolean(item.product.file_url)) ? (
                      <Button
                        size="sm" variant="outline" className="w-full h-8 text-xs"
                        disabled={downloading === item.id}
                        onClick={() => handleDownload(`/api/payments/library/${item.id}/download`, item.product.title, item.id)}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        {downloading === item.id ? "Downloading..." : "Download"}
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
                <div key={ticket.id} className="rounded-3xl border border-gray-100 bg-white overflow-hidden flex flex-col">
                  {/* QR preview */}
                  <div className="relative flex h-36 shrink-0 items-center justify-center bg-brand-50/60">
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
                            <div className="rounded-2xl border border-gray-100 bg-brand-50/50 flex items-center justify-center p-4">
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

                            {(ticket.ticket_png_url || ticket.qr_code_url) && (
                              <Button
                                size="sm" variant="outline" className="w-full h-8 text-xs"
                                onClick={() => window.open(getImageUrl(ticket.ticket_png_url || ticket.qr_code_url!), '_blank')}
                              >
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                Open &amp; Save Ticket
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

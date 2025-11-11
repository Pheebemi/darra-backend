"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SafeImage } from "@/components/safe-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Ticket, QrCode, Download, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "sonner";

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

export default function MyTicketsPage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<EventTicket | null>(null);

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchLibrary();
    }
  }, [isAuthenticated]);

  const fetchLibrary = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/payments/library");
      if (!response.ok) throw new Error("Failed to fetch library");
      const data = await response.json();
      setItems(data.results || data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  if (!initialized || !isAuthenticated) {
    return null;
  }

  const eventTickets = items.filter(
    (item) => item.product.product_type === "event" && item.event_tickets
  );
  const otherItems = items.filter(
    (item) => item.product.product_type !== "event" || !item.event_tickets
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">My Tickets</h1>
        <p className="mt-2 text-foreground/70">
          View and manage your purchased tickets
        </p>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <Skeleton className="h-48 w-full" />
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Ticket className="h-16 w-16 text-foreground/30" />
          <h2 className="mt-4 text-2xl font-semibold">No tickets yet</h2>
          <p className="mt-2 text-foreground/70">
            Purchase tickets to see them here
          </p>
          <Button asChild className="mt-6">
            <a href="/tickets">Browse Tickets</a>
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {eventTickets.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold">Event Tickets</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {eventTickets.map((item) =>
                  item.event_tickets?.map((ticket) => (
                    <Card key={ticket.id} className="overflow-hidden">
                      <div className="relative h-48 w-full bg-gradient-to-br from-primary/20 to-primary/5">
                        {ticket.qr_code_url ? (
                          <SafeImage
                            src={ticket.qr_code_url}
                            alt="QR Code"
                            fill
                            className="object-contain p-4"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <QrCode className="h-16 w-16 text-primary/30" />
                          </div>
                        )}
                      </div>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{item.product.title}</CardTitle>
                          {ticket.is_used ? (
                            <Badge variant="destructive">
                              <XCircle className="mr-1 h-3 w-3" />
                              Used
                            </Badge>
                          ) : (
                            <Badge variant="default">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Valid
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-foreground/60">
                          Ticket ID: {ticket.ticket_id}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => setSelectedTicket(ticket)}
                            >
                              <QrCode className="mr-2 h-4 w-4" />
                              View Ticket
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>{item.product.title}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              {ticket.qr_code_url && (
                                <div className="relative mx-auto aspect-square w-full max-w-xs">
                                  <SafeImage
                                    src={ticket.qr_code_url}
                                    alt="QR Code"
                                    fill
                                    className="object-contain"
                                  />
                                </div>
                              )}
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-foreground/70">Ticket ID:</span>
                                  <span className="font-mono">{ticket.ticket_id}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-foreground/70">Status:</span>
                                  {ticket.is_used ? (
                                    <Badge variant="destructive">Used</Badge>
                                  ) : (
                                    <Badge variant="default">Valid</Badge>
                                  )}
                                </div>
                              </div>
                              {ticket.ticket_png_url && (
                                <Button
                                  asChild
                                  variant="outline"
                                  className="w-full"
                                >
                                  <a
                                    href={ticket.ticket_png_url}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Download className="mr-2 h-4 w-4" />
                                    Download Ticket
                                  </a>
                                </Button>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}

          {otherItems.length > 0 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold">Digital Products</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {otherItems.map((item) => (
                  <Card key={item.id}>
                    <div className="relative h-48 w-full">
                      {item.product.cover_image_url ? (
                        <SafeImage
                          src={item.product.cover_image_url}
                          alt={item.product.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-muted">
                          <Ticket className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardHeader>
                      <CardTitle className="text-base">{item.product.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {item.product.file_url && (
                        <Button asChild variant="outline" className="w-full">
                          <a
                            href={item.product.file_url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


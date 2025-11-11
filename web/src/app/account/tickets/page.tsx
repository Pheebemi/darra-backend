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
import { 
  Ticket, 
  QrCode, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Calendar,
  MapPin,
  User,
  ArrowRight,
  Shield
} from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-900">
      <div className="absolute inset-0 bg-grid-slate-900/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-400/10 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />
      
      <div className="relative mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg">
              <Ticket className="h-8 w-8" />
            </div>
          </div>
          <h1 className="mb-4 text-4xl font-bold bg-gradient-to-br from-slate-900 to-blue-700 dark:from-slate-100 dark:to-blue-400 bg-clip-text text-transparent">
            My Tickets
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            View and manage your purchased tickets. All your event access in one place.
          </p>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="rounded-2xl border-slate-200/50 bg-white/80 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/80">
                <Skeleton className="h-48 w-full rounded-t-2xl" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full rounded-xl" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="rounded-2xl bg-white/80 p-8 backdrop-blur-xl dark:bg-slate-800/80 shadow-2xl text-center max-w-md">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 text-slate-400 mx-auto mb-6 dark:from-slate-700 dark:to-slate-600">
                <Ticket className="h-10 w-10" />
              </div>
              <h2 className="mb-3 text-2xl font-semibold text-slate-900 dark:text-white">
                No tickets yet
              </h2>
              <p className="mb-6 text-slate-600 dark:text-slate-300">
                Purchase tickets to see them here. Your upcoming events will appear in this section.
              </p>
              <Button 
                asChild 
                className="rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
                size="lg"
              >
                <a href="/tickets">
                  Browse Events
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {eventTickets.length > 0 && (
              <div>
                <div className="mb-8 text-center">
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
                    Event Tickets
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300 text-lg">
                    Your upcoming events and access passes
                  </p>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {eventTickets.map((item) =>
                    item.event_tickets?.map((ticket) => (
                      <Card 
                        key={ticket.id} 
                        className="overflow-hidden rounded-2xl border-slate-200/50 bg-white/80 backdrop-blur-xl transition-all hover:shadow-xl hover:scale-105 dark:border-slate-700/50 dark:bg-slate-800/80"
                      >
                        <div className="relative h-48 w-full bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                          {ticket.qr_code_url ? (
                            <SafeImage
                              src={ticket.qr_code_url}
                              alt="QR Code"
                              fill
                              className="object-contain p-6"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <QrCode className="h-16 w-16 text-blue-400/30" />
                            </div>
                          )}
                          <div className="absolute top-4 right-4">
                            {ticket.is_used ? (
                              <Badge className="rounded-full bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                                <XCircle className="mr-1 h-3 w-3" />
                                Used
                              </Badge>
                            ) : (
                              <Badge className="rounded-full bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Valid
                              </Badge>
                            )}
                          </div>
                        </div>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                            {item.product.title}
                          </CardTitle>
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                            <Shield className="h-4 w-4" />
                            <span className="font-mono text-xs">ID: {ticket.ticket_id}</span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full rounded-xl border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50 dark:hover:bg-slate-700"
                                onClick={() => setSelectedTicket(ticket)}
                              >
                                <QrCode className="mr-2 h-4 w-4" />
                                View Ticket
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md rounded-2xl border-slate-200/50 bg-white/80 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/80">
                              <DialogHeader className="text-center">
                                <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white">
                                  {item.product.title}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-6">
                                {ticket.qr_code_url && (
                                  <div className="relative mx-auto aspect-square w-full max-w-xs rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 p-6 dark:from-blue-900/20 dark:to-purple-900/20">
                                    <SafeImage
                                      src={ticket.qr_code_url}
                                      alt="QR Code"
                                      fill
                                      className="object-contain"
                                    />
                                  </div>
                                )}
                                <div className="space-y-3 text-sm">
                                  <div className="flex justify-between items-center py-2 border-b border-slate-200/50 dark:border-slate-700/50">
                                    <span className="text-slate-600 dark:text-slate-400">Ticket ID:</span>
                                    <span className="font-mono text-slate-900 dark:text-white">{ticket.ticket_id}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-2 border-b border-slate-200/50 dark:border-slate-700/50">
                                    <span className="text-slate-600 dark:text-slate-400">Status:</span>
                                    {ticket.is_used ? (
                                      <Badge variant="destructive" className="rounded-full">Used</Badge>
                                    ) : (
                                      <Badge className="rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Valid</Badge>
                                    )}
                                  </div>
                                  <div className="flex justify-between items-center py-2">
                                    <span className="text-slate-600 dark:text-slate-400">Purchased:</span>
                                    <span className="text-slate-900 dark:text-white">
                                      {new Date(ticket.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                                {ticket.ticket_png_url && (
                                  <Button
                                    asChild
                                    variant="outline"
                                    className="w-full rounded-xl border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50 dark:hover:bg-slate-700"
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
                <div className="mb-8 text-center">
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
                    Digital Products
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300 text-lg">
                    Your purchased digital content and downloads
                  </p>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {otherItems.map((item) => (
                    <Card 
                      key={item.id} 
                      className="overflow-hidden rounded-2xl border-slate-200/50 bg-white/80 backdrop-blur-xl transition-all hover:shadow-xl hover:scale-105 dark:border-slate-700/50 dark:bg-slate-800/80"
                    >
                      <div className="relative h-48 w-full">
                        {item.product.cover_image_url ? (
                          <SafeImage
                            src={item.product.cover_image_url}
                            alt={item.product.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600">
                            <Ticket className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                          </div>
                        )}
                      </div>
                      <CardHeader>
                        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                          {item.product.title}
                        </CardTitle>
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                          {item.product.description}
                        </p>
                      </CardHeader>
                      <CardContent>
                        {item.product.file_url && (
                          <Button 
                            asChild 
                            variant="outline" 
                            className="w-full rounded-xl border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50 dark:hover:bg-slate-700"
                          >
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
    </div>
  );
}
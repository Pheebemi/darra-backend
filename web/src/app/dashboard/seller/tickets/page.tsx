"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Ticket,
  User,
  Calendar,
  ShoppingCart,
  CreditCard,
  DollarSign,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface TicketBuyer {
  full_name: string;
  email: string;
}

interface TicketEvent {
  title: string;
  event_date: string;
  description?: string;
}

interface TicketVerifier {
  full_name: string;
}

interface EventTicket {
  ticket_id: string;
  buyer: TicketBuyer;
  event: TicketEvent;
  quantity: number;
  is_used: boolean;
  used_at: string | null;
  verified_by: TicketVerifier | null;
  verified_at: string | null;
  created_at: string;
  purchase_reference: string;
  payment_amount: string;
  qr_code_url?: string;
  pdf_ticket_url?: string;
  ticket_tier?: {
    name: string;
    price: string;
    category: {
      name: string;
      color: string;
    };
  };
}

interface TicketStats {
  total: number;
  valid: number;
  used: number;
}

export default function SellerTicketsPage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "valid" | "used">("all");
  const [stats, setStats] = useState<TicketStats>({
    total: 0,
    valid: 0,
    used: 0,
  });

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchEventTickets();
      fetchEventStats();
    }
  }, [isAuthenticated]);

  const fetchEventTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/seller/tickets");
      if (response.ok) {
        const data = await response.json();
        setTickets(Array.isArray(data) ? data : []);
      } else {
        toast.error("Failed to fetch tickets");
      }
    } catch (error: any) {
      console.error("Error fetching tickets:", error);
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  const fetchEventStats = async () => {
    try {
      const response = await fetch("/api/seller/tickets/stats");
      if (response.ok) {
        const data = await response.json();
        setStats({
          total: data.total_tickets || 0,
          valid: data.valid_tickets || 0,
          used: data.used_tickets || 0,
        });
      }
    } catch (error: any) {
      console.error("Error fetching stats:", error);
      // Set default values on error
      setStats({
        total: 0,
        valid: 0,
        used: 0,
      });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchEventTickets(), fetchEventStats()]);
    setRefreshing(false);
  };

  const getFilteredTickets = () => {
    switch (filter) {
      case "valid":
        return tickets.filter((ticket) => !ticket.is_used);
      case "used":
        return tickets.filter((ticket) => ticket.is_used);
      default:
        return tickets;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return "₦0";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount);
  };

  if (!initialized || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-foreground/70">Loading...</p>
      </div>
    );
  }

  const userType = (user?.user_type || "buyer").toLowerCase();
  if (userType !== "seller") {
    router.push("/dashboard/buyer");
    return null;
  }

  const filteredTickets = getFilteredTickets();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/seller">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Event Tickets
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your event tickets
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold">{stats.total}</div>
              <div className="mt-2 text-sm text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-green-600">
                {stats.valid}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">Valid</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-red-600">
                {stats.used}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">Used</div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Buttons */}
        <div className="mb-6 flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            className="flex-1"
          >
            All ({stats.total})
          </Button>
          <Button
            variant={filter === "valid" ? "default" : "outline"}
            onClick={() => setFilter("valid")}
            className="flex-1"
          >
            Valid ({stats.valid})
          </Button>
          <Button
            variant={filter === "used" ? "default" : "outline"}
            onClick={() => setFilter("used")}
            className="flex-1"
          >
            Used ({stats.used})
          </Button>
        </div>

        {/* Tickets List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="mb-4 h-6 w-3/4" />
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTickets.length > 0 ? (
          <div className="space-y-4">
            {filteredTickets.map((ticket) => (
              <Card key={ticket.ticket_id}>
                <CardContent className="p-6">
                  {/* Ticket Header */}
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">
                        {ticket.event.title}
                      </h3>
                      <p className="mt-1 text-sm font-mono text-muted-foreground">
                        Ticket ID: {ticket.ticket_id}
                      </p>
                    </div>
                    <Badge
                      className={
                        ticket.is_used
                          ? "bg-red-500"
                          : "bg-green-500"
                      }
                    >
                      {ticket.is_used ? (
                        <XCircle className="mr-1 h-3 w-3" />
                      ) : (
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                      )}
                      {ticket.is_used ? "Used" : "Valid"}
                    </Badge>
                  </div>

                  {/* Ticket Info */}
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">
                          Buyer
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        {ticket.buyer.full_name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">
                          Event Date
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        {formatDate(ticket.event.event_date)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">
                          Quantity
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        {ticket.quantity}
                      </span>
                    </div>

                    {ticket.ticket_tier && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-muted-foreground">
                            Ticket Tier
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            style={{
                              backgroundColor: `${ticket.ticket_tier.category.color}20`,
                              color: ticket.ticket_tier.category.color,
                            }}
                          >
                            {ticket.ticket_tier.category.name}
                          </Badge>
                          <span className="text-sm font-medium">
                            {ticket.ticket_tier.name}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">
                          Purchase Reference
                        </span>
                      </div>
                      <span className="text-sm font-mono font-medium">
                        {ticket.purchase_reference}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t pt-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">
                          Payment Amount
                        </span>
                      </div>
                      <span className="text-lg font-bold text-primary">
                        {formatCurrency(ticket.payment_amount)}
                      </span>
                    </div>

                    {ticket.is_used && ticket.verified_by && (
                      <div className="rounded-lg bg-muted p-3">
                        <div className="text-sm font-medium text-muted-foreground">
                          Verified by: {ticket.verified_by.full_name}
                        </div>
                        {ticket.verified_at && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Verified at: {formatDate(ticket.verified_at)}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-2 text-xs text-muted-foreground">
                      Created: {formatDate(ticket.created_at)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Ticket className="mb-4 h-16 w-16 text-muted-foreground" />
              <h2 className="mb-2 text-xl font-semibold">No Tickets Found</h2>
              <p className="mb-6 text-center text-muted-foreground">
                {filter === "all"
                  ? "You haven't sold any tickets yet."
                  : filter === "valid"
                  ? "No valid tickets found."
                  : "No used tickets found."}
              </p>
              {filter !== "all" && (
                <Button variant="outline" onClick={() => setFilter("all")}>
                  View All Tickets
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}


"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, CheckCircle2, XCircle, User, Package } from "lucide-react";
import { toast } from "sonner";

interface EventTicket {
  ticket_id: string;
  buyer: { full_name: string; email: string };
  event: { title: string; event_date: string };
  quantity: number;
  is_used: boolean;
  used_at: string | null;
  verified_by: { full_name: string } | null;
  verified_at: string | null;
  created_at: string;
  purchase_reference: string;
  payment_amount: string;
  ticket_tier?: { name: string; price: string; category: { name: string; color: string } };
}

interface Stats { total: number; valid: number; used: number }

const fmt = (v: string | number) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "₦0";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function SellerPurchasesPage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, valid: 0, used: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "valid" | "used">("all");

  useEffect(() => {
    if (initialized && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAll();
    }
  }, [isAuthenticated]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [ticketsRes, statsRes] = await Promise.allSettled([
        fetch("/api/seller/tickets"),
        fetch("/api/seller/tickets/stats"),
      ]);
      if (ticketsRes.status === "fulfilled" && ticketsRes.value.ok) {
        const d = await ticketsRes.value.json();
        setTickets(Array.isArray(d) ? d : []);
      }
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        const d = await statsRes.value.json();
        setStats({ total: d.total_tickets || 0, valid: d.valid_tickets || 0, used: d.used_tickets || 0 });
      }
    } catch {
      toast.error("Failed to load purchases");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => { setRefreshing(true); await fetchAll(); };

  if (!initialized || !isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  if ((user?.user_type || "buyer").toLowerCase() !== "seller") {
    router.push("/dashboard/buyer");
    return null;
  }

  const filtered = filter === "valid"
    ? tickets.filter((t) => !t.is_used)
    : filter === "used"
    ? tickets.filter((t) => t.is_used)
    : tickets;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Purchases</h1>
            <p className="text-sm text-muted-foreground">All purchases made on your products</p>
          </div>
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={refreshing} className="h-8 text-xs">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-foreground" },
            { label: "Valid", value: stats.valid, color: "text-emerald-600" },
            { label: "Used", value: stats.used, color: "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="shadow-none">
              <CardContent className="px-4 py-3 text-center">
                <p className={`text-2xl font-semibold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 border rounded-md p-0.5 w-fit">
          {([
            { key: "all", label: `All (${stats.total})` },
            { key: "valid", label: `Valid (${stats.valid})` },
            { key: "used", label: `Used (${stats.used})` },
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

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="divide-y border rounded-lg overflow-hidden">
            {filtered.map((ticket) => (
              <div key={ticket.ticket_id} className="flex items-start gap-4 bg-card px-4 py-3">
                {/* Status icon */}
                <div className="mt-0.5 shrink-0">
                  {ticket.is_used ? (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{ticket.event.title}</p>
                    <Badge
                      variant={ticket.is_used ? "secondary" : "default"}
                      className={`text-[10px] px-1.5 h-4 shrink-0 ${!ticket.is_used ? "bg-emerald-500 hover:bg-emerald-500" : ""}`}
                    >
                      {ticket.is_used ? "Used" : "Valid"}
                    </Badge>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {ticket.buyer.full_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Qty: {ticket.quantity}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {ticket.purchase_reference}
                    </span>
                  </div>

                  {ticket.is_used && ticket.verified_by && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Verified by {ticket.verified_by.full_name}
                      {ticket.verified_at ? ` · ${fmtDate(ticket.verified_at)}` : ""}
                    </p>
                  )}

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {fmtDate(ticket.created_at)}
                  </p>
                </div>

                {/* Amount */}
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-primary">{fmt(ticket.payment_amount)}</p>
                  {ticket.ticket_tier && (
                    <p className="text-[11px] text-muted-foreground">{ticket.ticket_tier.name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border bg-card py-12 text-center">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium">No purchases found</p>
            <p className="text-xs text-muted-foreground">
              {filter !== "all" ? "Try switching to All" : "Purchases will appear once customers buy your products"}
            </p>
            {filter !== "all" && (
              <Button size="sm" variant="outline" className="mt-3 h-7 text-xs" onClick={() => setFilter("all")}>
                View all
              </Button>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, CheckCircle2, XCircle, User } from "lucide-react";
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
  ticket_tier?: { name: string; display_name?: string; color?: string; price: string; category?: { name: string; color: string } };
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
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
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
      <div className="mx-auto max-w-4xl space-y-8 p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-500">Sales</p>
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Purchases</h1>
          </div>
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", value: stats.total, color: "text-ink" },
            { label: "Valid", value: stats.valid, color: "text-[#00B42A]" },
            { label: "Used", value: stats.used, color: "text-gray-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-3xl border border-gray-100 bg-white p-5 text-center">
              <p className={`text-2xl font-semibold ${color}`}>{value}</p>
              <p className="text-xs text-gray-600">{label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex w-fit gap-1 rounded-full border border-gray-200 bg-white p-1">
          {([
            { key: "all", label: `All (${stats.total})` },
            { key: "valid", label: `Valid (${stats.valid})` },
            { key: "used", label: `Used (${stats.used})` },
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

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-3xl" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((ticket) => (
              <div key={ticket.ticket_id} className="flex items-start gap-4 rounded-3xl border border-gray-100 bg-white p-5">
                {/* Status icon */}
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ticket.is_used ? "bg-gray-100" : "bg-[#EBFBF0]"}`}>
                  {ticket.is_used ? (
                    <XCircle className="h-4 w-4 text-gray-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-[#00B42A]" />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-gray-900">{ticket.event.title}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      ticket.is_used ? "bg-gray-100 text-gray-500" : "bg-[#EBFBF0] text-[#00B42A]"
                    }`}>
                      {ticket.is_used ? "Used" : "Valid"}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                    <span className="flex items-center gap-1 text-xs text-gray-600">
                      <User className="h-3 w-3 text-brand-500" />
                      {ticket.buyer.full_name}
                    </span>
                    <span className="text-xs text-gray-600">
                      Qty: {ticket.quantity}
                    </span>
                    <span className="font-mono text-xs text-gray-500">
                      {ticket.purchase_reference}
                    </span>
                  </div>

                  {ticket.is_used && ticket.verified_by && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      Verified by {ticket.verified_by.full_name}
                      {ticket.verified_at ? ` · ${fmtDate(ticket.verified_at)}` : ""}
                    </p>
                  )}

                  <p className="mt-0.5 text-xs text-gray-500">
                    {fmtDate(ticket.created_at)}
                  </p>
                </div>

                {/* Amount */}
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-brand-500">{fmt(ticket.payment_amount)}</p>
                  {ticket.ticket_tier && (
                    <p className="text-[11px] text-gray-500">{ticket.ticket_tier.display_name || ticket.ticket_tier.name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-brand-200 bg-white py-16 text-center">
            <img src="/illustrations/no-data.svg" alt="" className="mb-6 h-28 w-auto" />
            <p className="font-medium text-ink">No purchases found</p>
            <p className="mt-1 text-xs text-gray-600">
              {filter !== "all" ? "Try switching to All" : "Purchases will appear once customers buy your products"}
            </p>
            {filter !== "all" && (
              <Button size="sm" variant="outline" className="mt-4" onClick={() => setFilter("all")}>
                View all
              </Button>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag, Ticket, TrendingUp, Heart } from "lucide-react";
import { toast } from "sonner";

interface LibraryItem {
  id: number;
  product: {
    id: number;
    title: string;
    product_type: string;
    cover_image_url?: string;
  };
  event_tickets?: Array<{ id: number }>;
}

interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  cover_image?: string;
  product_type: string;
  is_ticket_event?: boolean;
}

export default function BuyerDashboard() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const [ticketCount, setTicketCount] = useState(0);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch library to get ticket count
      const libraryResponse = await fetch("/api/payments/library");
      if (libraryResponse.ok) {
        const libraryData = await libraryResponse.json();
        const items: LibraryItem[] = libraryData.results || libraryData;
        const tickets = items.reduce((count, item) => {
          if (item.product.product_type === "event" && item.event_tickets) {
            return count + item.event_tickets.length;
          }
          return count;
        }, 0);
        setTicketCount(tickets);
      }

      // Fetch featured products
      const productsResponse = await fetch("/api/products?product_type=event");
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        setFeaturedProducts(productsData.slice(0, 3));
      }
    } catch (error: any) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!initialized || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-foreground/70">Loading...</p>
      </div>
    );
  }

  const userType = (user?.user_type || "buyer").toLowerCase();
  if (userType !== "buyer") {
    router.push("/dashboard/seller");
    return null;
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, {user?.full_name || "Buyer"}!
        </h1>
        <p className="mt-2 text-foreground/70">
          Discover and purchase tickets for your favorite events
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{ticketCount}</div>
            )}
            <p className="text-xs text-muted-foreground">Purchased tickets</p>
            <Button asChild variant="link" className="mt-2 p-0 h-auto">
              <Link href="/account/tickets">View all</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Browse Events</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Explore available tickets
            </p>
            <Button asChild>
              <Link href="/tickets">Browse Tickets</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trending</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Popular events right now
            </p>
            <Button asChild variant="outline">
              <Link href="/tickets?filter=trending">View Trending</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saved</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Saved events</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-xl font-semibold">Featured Events</h2>
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <Skeleton className="h-40 w-full" />
                <CardHeader>
                  <Skeleton className="h-4 w-3/4" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : featuredProducts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map((product) => (
              <Card key={product.id} className="overflow-hidden">
                <div className="relative h-40 w-full">
                  {product.cover_image ? (
                    <SafeImage
                      src={product.cover_image}
                      alt={product.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-700" />
                  )}
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base line-clamp-1">{product.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-sm text-foreground/70">
                    From ₦{product.price.toLocaleString()}
                  </span>
                  <Button size="sm" asChild>
                    <Link href={`/tickets/${product.id}`}>View</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-center text-foreground/70">No featured events available</p>
        )}
      </div>
      </div>
    </DashboardLayout>
  );
}


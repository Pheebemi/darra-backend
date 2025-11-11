"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Ticket, ShoppingBag, Filter, Calendar, MapPin, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface TicketTier {
  id: number;
  name: string;
  price: number;
  quantity_available: number;
  remaining_quantity: number;
  is_sold_out: boolean;
}

interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  product_type: string;
  cover_image?: string;
  created_at: string;
  event_date?: string;
  ticket_tiers?: TicketTier[];
  is_ticket_event?: boolean;
  seller_name: string;
}

const CATEGORIES = [
  { id: "all", name: "All Events", icon: Ticket },
  { id: "event", name: "Concerts", icon: Users },
  { id: "png", name: "Images", icon: ShoppingBag },
  { id: "digital", name: "Digital", icon: ShoppingBag },
  { id: "template", name: "Templates", icon: ShoppingBag },
];

export default function TicketsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    let filtered = [...products];

    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (product) => product.product_type === selectedCategory
      );
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (product) =>
          product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredProducts(filtered);
  }, [products, selectedCategory, searchQuery]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      const data = await response.json();
      setProducts(data);
      setFilteredProducts(data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const getMinPrice = (product: Product) => {
    if (product.is_ticket_event && product.ticket_tiers?.length) {
      const prices = product.ticket_tiers
        .filter((tier) => !tier.is_sold_out)
        .map((tier) => tier.price);
      return prices.length > 0 ? Math.min(...prices) : null;
    }
    return product.price;
  };

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
            Discover Events
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Find and purchase tickets for amazing experiences. Your next adventure awaits.
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 rounded-2xl border border-slate-200/50 bg-white/80 p-6 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/80">
          <div className="mb-6 flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search events, artists, venues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-xl border-slate-300 bg-white pl-12 pr-4 py-3 text-base transition-colors focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white"
              />
            </div>
            <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 px-6">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>

          {/* Categories */}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                    selectedCategory === cat.id
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                      : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="rounded-2xl border-slate-200/50 bg-white/80 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/80">
                <Skeleton className="h-48 w-full rounded-t-2xl" />
                <CardHeader className="space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="rounded-2xl bg-white/80 p-8 backdrop-blur-xl dark:bg-slate-800/80 shadow-2xl text-center max-w-md">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 text-slate-400 mx-auto mb-6 dark:from-slate-700 dark:to-slate-600">
                <ShoppingBag className="h-10 w-10" />
              </div>
              <h2 className="mb-3 text-2xl font-semibold text-slate-900 dark:text-white">
                No events found
              </h2>
              <p className="mb-6 text-slate-600 dark:text-slate-300">
                {searchQuery
                  ? "Try adjusting your search terms or filters"
                  : "Check back soon for new events and experiences"}
              </p>
              {searchQuery && (
                <Button 
                  onClick={() => setSearchQuery("")}
                  variant="outline" 
                  className="rounded-xl border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50 dark:hover:bg-slate-700"
                >
                  Clear Search
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const minPrice = getMinPrice(product);
              return (
                <Card 
                  key={product.id} 
                  className="group overflow-hidden rounded-2xl border-slate-200/50 bg-white/80 backdrop-blur-xl transition-all hover:shadow-2xl hover:scale-105 dark:border-slate-700/50 dark:bg-slate-800/80"
                >
                  <Link href={`/tickets/${product.id}`}>
                    <div className="relative h-48 w-full overflow-hidden">
                      {product.cover_image ? (
                        <SafeImage
                          src={product.cover_image}
                          alt={product.title}
                          fill
                          className="object-cover transition-transform group-hover:scale-110"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                          <Ticket className="h-12 w-12 text-blue-400/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute top-4 right-4">
                        <Badge className="rounded-full bg-white/90 backdrop-blur-sm text-slate-700 border-none shadow-lg dark:bg-slate-800/90 dark:text-slate-300">
                          {product.product_type.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    <CardHeader className="pb-3">
                      <CardTitle className="line-clamp-1 text-lg font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                        {product.title}
                      </CardTitle>
                      <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                        {product.description}
                      </p>
                      {product.event_date && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                          <Calendar className="h-3 w-3" />
                          {new Date(product.event_date).toLocaleDateString()}
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <div>
                        {minPrice !== null ? (
                          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                            From ₦{minPrice.toLocaleString()}
                          </p>
                        ) : (
                          <p className="text-sm text-red-600 dark:text-red-400 font-medium">Sold out</p>
                        )}
                        {product.is_ticket_event && product.ticket_tiers && (
                          <p className="text-xs text-slate-500 dark:text-slate-500">
                            {product.ticket_tiers.length} ticket types available
                          </p>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        className="rounded-xl bg-blue-600 hover:bg-blue-700 group-hover:scale-110 transition-transform"
                      >
                        View
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </CardContent>
                  </Link>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
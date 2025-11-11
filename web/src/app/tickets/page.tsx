"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Ticket, ShoppingBag } from "lucide-react";
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
  { id: "all", name: "All" },
  { id: "event", name: "Events" },
  { id: "png", name: "Images" },
  { id: "digital", name: "Digital" },
  { id: "template", name: "Templates" },
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
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Browse Tickets</h1>
        <p className="mt-2 text-foreground/70">
          Discover and purchase tickets for amazing events
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
          <Input
            placeholder="Search events, artists, venues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.name}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <Skeleton className="h-48 w-full" />
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <ShoppingBag className="h-12 w-12 text-foreground/30" />
          <p className="mt-4 text-lg font-medium text-foreground">
            No products found
          </p>
          <p className="mt-2 text-sm text-foreground/70">
            {searchQuery
              ? "Try a different search term"
              : "Products will appear here when available"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => {
            const minPrice = getMinPrice(product);
            return (
              <Card key={product.id} className="overflow-hidden">
                <Link href={`/tickets/${product.id}`}>
                  <div className="relative h-48 w-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-700">
                    {product.cover_image ? (
                      <SafeImage
                        src={product.cover_image}
                        alt={product.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Ticket className="h-12 w-12 text-foreground/30" />
                      </div>
                    )}
                  </div>
                  <CardHeader>
                    <CardTitle className="line-clamp-1">{product.title}</CardTitle>
                    <p className="line-clamp-2 text-sm text-foreground/70">
                      {product.description}
                    </p>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div>
                      {minPrice !== null ? (
                        <p className="text-lg font-semibold text-primary">
                          From ₦{minPrice.toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-sm text-foreground/70">Sold out</p>
                      )}
                      {product.is_ticket_event && product.ticket_tiers && (
                        <p className="text-xs text-foreground/60">
                          {product.ticket_tiers.length} ticket types
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary">
                      {product.product_type.toUpperCase()}
                    </Badge>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}


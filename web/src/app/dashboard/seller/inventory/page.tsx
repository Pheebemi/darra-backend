"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeImage } from "@/components/safe-image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Filter,
  Edit,
  Share2,
  MoreVertical,
  Calendar,
  Users,
  X,
  Package,
  FileText,
  Music,
  File,
  Archive,
  Video,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  product_type: string;
  cover_image?: string;
  file?: string;
  created_at: string;
  event_date?: string;
  ticket_quantity?: number;
  is_ticket_event?: boolean;
}

const PRODUCT_TYPES = [
  { label: "All Products", value: "", icon: Package, color: "#6B7280" },
  {
    label: "PDF Documents",
    value: "pdf",
    icon: FileText,
    color: "#DC2626",
  },
  {
    label: "Audio Files",
    value: "mp3",
    icon: Music,
    color: "#7C3AED",
  },
  {
    label: "Word Documents",
    value: "docx",
    icon: File,
    color: "#2563EB",
  },
  {
    label: "Images",
    value: "png",
    icon: FileText,
    color: "#059669",
  },
  {
    label: "Archives",
    value: "zip",
    icon: Archive,
    color: "#D97706",
  },
  {
    label: "Videos",
    value: "video",
    icon: Video,
    color: "#DC2626",
  },
  {
    label: "Events & Tickets",
    value: "event",
    icon: Ticket,
    color: "#EC4899",
  },
];

export default function InventoryPage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProducts();
    }
  }, [isAuthenticated]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/seller/products");
      if (response.ok) {
        const data = await response.json();
        setProducts(Array.isArray(data) ? data : []);
      } else {
        toast.error("Failed to fetch products");
      }
    } catch (error: any) {
      console.error("Error fetching products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const handleProductPress = (product: Product) => {
    // For now, navigate to edit page. You can create a detail page later if needed
    router.push(`/dashboard/seller/create-event?edit=${product.id}`);
  };

  const handleEditProduct = (product: Product) => {
    router.push(`/dashboard/seller/create-event?edit=${product.id}`);
  };

  const clearSearch = () => {
    setSearch("");
  };

  const clearFilter = () => {
    setFilterType("");
    setShowFilterModal(false);
  };

  const selectFilter = (value: string) => {
    setFilterType(value);
    setShowFilterModal(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getProductTypeIcon = (type: string) => {
    const productType = PRODUCT_TYPES.find((pt) => pt.value === type);
    return productType ? productType.icon : Package;
  };

  const getProductTypeColor = (type: string) => {
    const productType = PRODUCT_TYPES.find((pt) => pt.value === type);
    return productType ? productType.color : "#6B7280";
  };

  // Filtered products
  const filteredProducts = products.filter((p) => {
    if (filterType === "event") {
      return p.product_type === "event" || p.is_ticket_event === true;
    }
    if (filterType && filterType !== "event") {
      return p.product_type === filterType;
    }
    return true;
  }).filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.description?.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch;
  });

  const getActiveFilterLabel = () => {
    const activeFilter = PRODUCT_TYPES.find((type) => type.value === filterType);
    return activeFilter ? activeFilter.label : "All Products";
  };

  const hasActiveFilters = search.length > 0 || filterType.length > 0;

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

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Products</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {products.length} {products.length === 1 ? "product" : "products"}
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/seller/create-event">
              <Plus className="mr-2 h-4 w-4" />
              Create Product
            </Link>
          </Button>
        </div>

        {/* Search and Filter Section */}
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products, descriptions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
            {search.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                onClick={clearSearch}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Dialog open={showFilterModal} onOpenChange={setShowFilterModal}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                {filterType ? getActiveFilterLabel() : "Filter"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Filter Products</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {PRODUCT_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <Button
                      key={type.value}
                      variant={filterType === type.value ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => selectFilter(type.value)}
                    >
                      <Icon
                        className="mr-2 h-4 w-4"
                        style={{ color: type.color }}
                      />
                      {type.label}
                    </Button>
                  );
                })}
              </div>
              {filterType && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={clearFilter}
                >
                  Clear Filter
                </Button>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="mb-6 flex flex-wrap gap-2">
            {search.length > 0 && (
              <Badge variant="secondary" className="gap-2">
                <Search className="h-3 w-3" />
                "{search}"
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0"
                  onClick={clearSearch}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            {filterType && (
              <Badge variant="secondary" className="gap-2">
                {getActiveFilterLabel()}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0"
                  onClick={clearFilter}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            <p className="text-sm text-muted-foreground">
              {filteredProducts.length} result
              {filteredProducts.length !== 1 ? "s" : ""} found
            </p>
          </div>
        )}

        {/* Products List */}
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <Skeleton className="h-48 w-full" />
                <CardHeader>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const Icon = getProductTypeIcon(product.product_type);
              const color = getProductTypeColor(product.product_type);

              return (
                <Card
                  key={product.id}
                  className="cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
                  onClick={() => handleProductPress(product)}
                >
                  {product.cover_image && (
                    <div className="relative h-48 w-full">
                      <SafeImage
                        src={product.cover_image}
                        alt={product.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="mb-2 flex items-center justify-between">
                      <Badge
                        variant="secondary"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        <Icon className="mr-1 h-3 w-3" />
                        {product.product_type.toUpperCase()}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditProduct(product);
                        }}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardTitle className="line-clamp-2">{product.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 line-clamp-3 text-sm text-muted-foreground">
                      {product.description}
                    </p>
                    {product.event_date && (
                      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {formatDate(product.event_date)}
                      </div>
                    )}
                    {product.ticket_quantity && (
                      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {product.ticket_quantity} tickets
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-lg font-bold">
                        ₦{product.price.toLocaleString()}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditProduct(product);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle share
                          }}
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="mb-4 h-16 w-16 text-muted-foreground" />
              <h2 className="mb-2 text-xl font-semibold">
                {hasActiveFilters ? "No products found" : "No products yet"}
              </h2>
              <p className="mb-6 text-center text-muted-foreground">
                {hasActiveFilters
                  ? "Try adjusting your search or filter criteria"
                  : "Create your first product to start selling"}
              </p>
              {hasActiveFilters ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setFilterType("");
                  }}
                >
                  Clear Filters
                </Button>
              ) : (
                <Button asChild>
                  <Link href="/dashboard/seller/create-event">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Product
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}


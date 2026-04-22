"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  X,
  Plus,
  Trash2,
  Loader2,
  Image as ImageIcon,
  FileText,
  Ticket,
  Settings,
} from "lucide-react";
import { toast } from "sonner";

interface TicketCategory {
  id: number;
  name: string;
  description: string;
  color: string;
}

interface TicketType {
  id: number;
  category: TicketCategory;
  price: number;
  quantity: number;
}

const PRODUCT_TYPES = [
  { label: "PDF", value: "pdf" },
  { label: "MP3", value: "mp3" },
  { label: "DOCX", value: "docx" },
  { label: "ZIP", value: "zip" },
  { label: "Video", value: "video" },
  { label: "Event / Ticket", value: "event" },
];

function CreateEventInner() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit"); // product ID when editing
  const isEditing = !!editId;

  const [activeTab, setActiveTab] = useState("details");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [productType, setProductType] = useState("event");
  const [file, setFile] = useState<File | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);

  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);
  const [selectedTicketCategory, setSelectedTicketCategory] = useState<number | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [newTicketPrice, setNewTicketPrice] = useState("");
  const [newTicketQuantity, setNewTicketQuantity] = useState("");

  const [loading, setLoading] = useState(false);
  const [fetchingProduct, setFetchingProduct] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    if (initialized && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadTicketCategories();
      if (isEditing) fetchProductForEdit();
    }
  }, [isAuthenticated]);

  const loadTicketCategories = async () => {
    try {
      setCategoriesLoading(true);
      const res = await fetch("/api/ticket-categories");
      if (res.ok) setTicketCategories(await res.json());
    } catch {
      toast.error("Failed to load ticket categories");
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchProductForEdit = async () => {
    try {
      setFetchingProduct(true);
      const res = await fetch(`/api/products/${editId}`);
      if (!res.ok) throw new Error("Failed to fetch product");
      const data = await res.json();

      setTitle(data.title || "");
      setDescription(data.description || "");
      setPrice(data.price?.toString() || "");
      setProductType(data.product_type || "event");

      if (data.cover_image) {
        setExistingCoverUrl(data.cover_image);
        setCoverImagePreview(data.cover_image);
      }

      if (data.event_date) {
        const dt = new Date(data.event_date);
        setEventDate(dt.toISOString().split("T")[0]);
        setEventTime(dt.toTimeString().slice(0, 5));
      }

      // Pre-fill ticket tiers if event type — map to local TicketType shape
      if (data.ticket_tiers && Array.isArray(data.ticket_tiers)) {
        const mapped: TicketType[] = data.ticket_tiers.map((t: any) => ({
          id: t.id,
          category: t.category || { id: t.id, name: t.name || "Tier", description: "", color: "#3800ff" },
          price: t.price,
          quantity: t.quantity_available ?? t.quantity ?? 0,
        }));
        setTicketTypes(mapped);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load product");
    } finally {
      setFetchingProduct(false);
    }
  };

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please select a valid image file"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Image too large. Max 5MB"); return; }
    setCoverImage(f);
    const reader = new FileReader();
    reader.onloadend = () => setCoverImagePreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { toast.error("File too large. Max 50MB"); return; }
    setFile(f);
  };

  const addTicketType = () => {
    if (!selectedTicketCategory || !newTicketPrice || !newTicketQuantity) {
      toast.error("Select a category and fill price + quantity");
      return;
    }
    const cat = ticketCategories.find((c) => c.id === selectedTicketCategory);
    if (!cat) return;
    const p = parseFloat(newTicketPrice);
    const q = parseInt(newTicketQuantity);
    if (p <= 0 || q <= 0) { toast.error("Price and quantity must be > 0"); return; }
    setTicketTypes([...ticketTypes, { id: Date.now(), category: cat, price: p, quantity: q }]);
    setNewTicketPrice("");
    setNewTicketQuantity("");
    setSelectedTicketCategory(null);
    toast.success("Ticket type added");
  };

  const removeTicketType = (id: number) => {
    setTicketTypes(ticketTypes.filter((t) => t.id !== id));
  };

  const validateForm = () => {
    if (!title.trim()) { toast.error("Please enter a title"); return false; }
    if (!isEditing && !coverImage) { toast.error("Please select a cover image"); return false; }
    if (productType === "event") {
      if (!eventDate || !eventTime) { toast.error("Please provide event date and time"); return false; }
      if (ticketTypes.length === 0) { toast.error("Please add at least one ticket type"); return false; }
      const dt = new Date(`${eventDate}T${eventTime}`);
      if (dt <= new Date()) { toast.error("Event date must be in the future"); return false; }
    } else {
      if (!isEditing && !file) { toast.error("Please upload a file"); return false; }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || isSubmitting) return;
    setIsSubmitting(true);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("description_html", description.trim());
      formData.append("price", price || "0");
      formData.append("product_type", productType);

      if (productType === "event") {
        const dt = new Date(`${eventDate}T${eventTime}`);
        if (isNaN(dt.getTime())) { toast.error("Invalid date/time format"); return; }
        formData.append("event_date", dt.toISOString());
        formData.append(
          "ticket_types",
          JSON.stringify(ticketTypes.map((t) => ({
            category_id: t.category.id,
            price: t.price,
            quantity: t.quantity,
          })))
        );
      } else if (file) {
        formData.append("file", file);
      }

      if (coverImage) formData.append("cover_image", coverImage);

      const url = isEditing ? `/api/seller/products/${editId}` : "/api/seller/products";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, { method, body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || (isEditing ? "Failed to update product" : "Failed to create product"));
      }

      toast.success(isEditing ? "Product updated!" : "Product created!");
      setTimeout(() => router.push("/dashboard/seller/inventory"), 1200);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
      setIsSubmitting(false);
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

  if ((user?.user_type || "buyer").toLowerCase() !== "seller") {
    router.push("/dashboard/buyer");
    return null;
  }

  if (fetchingProduct) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-4 max-w-4xl">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
          <div className="grid gap-6 lg:grid-cols-3 mt-6">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const totalTickets = ticketTypes.reduce((s, t) => s + t.quantity, 0);
  const totalRevenue = ticketTypes.reduce((s, t) => s + t.price * t.quantity, 0);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-lg font-semibold">
            {isEditing ? "Edit Product" : "Add Product"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEditing ? "Update your product details" : "Set up your product details and pricing"}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details" className="flex items-center gap-1.5">
                  <Settings className="h-3.5 w-3.5" />Details
                </TabsTrigger>
                <TabsTrigger value="tickets" className="flex items-center gap-1.5" disabled={productType !== "event"}>
                  <Ticket className="h-3.5 w-3.5" />Tickets
                </TabsTrigger>
                <TabsTrigger value="media" className="flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" />Media
                </TabsTrigger>
              </TabsList>

              {/* Details tab */}
              <TabsContent value="details" className="space-y-4">
                <Card className="shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="title" className="text-xs">Title *</Label>
                      <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product title" className="h-9" />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="description" className="text-xs">Description</Label>
                      <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your product..." rows={4} />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="productType" className="text-xs">Product Type</Label>
                        <Select value={productType} onValueChange={setProductType}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCT_TYPES.map((pt) => (
                              <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {productType !== "event" && (
                        <div className="space-y-1.5">
                          <Label htmlFor="price" className="text-xs">Price (₦)</Label>
                          <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" step="0.01" min="0" className="h-9" />
                        </div>
                      )}
                    </div>

                    {productType === "event" && (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="eventDate" className="text-xs">Event Date *</Label>
                          <Input id="eventDate" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="eventTime" className="text-xs">Event Time *</Label>
                          <Input id="eventTime" type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="h-9" />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tickets tab */}
              <TabsContent value="tickets" className="space-y-4">
                <Card className="shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Ticket Configuration</CardTitle>
                    <CardDescription className="text-xs">Add ticket tiers with different prices and quantities</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add form */}
                    <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
                      <p className="text-xs font-medium">Add Ticket Type</p>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Category</Label>
                        {categoriesLoading ? (
                          <Skeleton className="h-9 w-full" />
                        ) : (
                          <Select value={selectedTicketCategory?.toString() || ""} onValueChange={(v) => setSelectedTicketCategory(parseInt(v))}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {ticketCategories.map((c) => (
                                <SelectItem key={c.id} value={c.id.toString()}>
                                  <div className="flex items-center gap-2">
                                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                                    {c.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Price (₦) *</Label>
                          <Input type="number" value={newTicketPrice} onChange={(e) => setNewTicketPrice(e.target.value)} placeholder="0.00" min="0" step="0.01" className="h-9" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Quantity *</Label>
                          <Input type="number" value={newTicketQuantity} onChange={(e) => setNewTicketQuantity(e.target.value)} placeholder="0" min="1" className="h-9" />
                        </div>
                      </div>
                      <Button size="sm" className="w-full h-8 text-xs" onClick={addTicketType} disabled={!selectedTicketCategory || !newTicketPrice || !newTicketQuantity}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />Add Ticket Type
                      </Button>
                    </div>

                    {/* Existing types */}
                    {ticketTypes.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Ticket Types ({ticketTypes.length})</p>
                        {ticketTypes.map((t) => (
                          <div key={t.id} className="flex items-center justify-between rounded-md border bg-card p-3">
                            <div className="flex items-center gap-3">
                              <Badge className="text-[10px]" style={{ backgroundColor: t.category.color }}>{t.category.name}</Badge>
                              <div>
                                <p className="text-sm font-semibold">₦{t.price.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">{t.quantity} available</p>
                              </div>
                            </div>
                            <button onClick={() => removeTicketType(t.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed py-8 text-center">
                        <Ticket className="mx-auto h-7 w-7 text-muted-foreground/40" />
                        <p className="mt-2 text-xs text-muted-foreground">No ticket types yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Media tab */}
              <TabsContent value="media" className="space-y-4">
                <Card className="shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Media & Files</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Cover image */}
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Cover Image {!isEditing && "*"}</Label>
                        <p className="text-xs text-muted-foreground">16:9 recommended · max 5MB</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Input type="file" accept="image/*" onChange={handleCoverImageChange} className="h-9 cursor-pointer flex-1 text-xs" />
                        {coverImagePreview && (
                          <div className="relative h-16 w-16 shrink-0">
                            <img src={coverImagePreview} alt="Preview" className="h-full w-full rounded-md border object-cover" />
                            <button
                              className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-white"
                              onClick={() => { setCoverImage(null); setCoverImagePreview(null); setExistingCoverUrl(null); }}
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      {isEditing && existingCoverUrl && !coverImage && (
                        <p className="text-xs text-muted-foreground">Current image shown above. Upload a new one to replace it.</p>
                      )}
                    </div>

                    {/* Product file */}
                    {productType !== "event" && (
                      <div className="space-y-2">
                        <Label className="text-xs">Product File {!isEditing && "*"}</Label>
                        <Input
                          type="file"
                          onChange={handleFileChange}
                          accept={productType === "pdf" ? ".pdf" : productType === "mp3" ? ".mp3" : productType === "docx" ? ".docx" : productType === "zip" ? ".zip" : productType === "video" ? "video/*" : "*"}
                          className="h-9 cursor-pointer text-xs"
                        />
                        {file && (
                          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{file.name}</p>
                              <p className="text-[11px] text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                            </div>
                            <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        {isEditing && !file && (
                          <p className="text-xs text-muted-foreground">Leave empty to keep the existing file.</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Summary */}
            {productType === "event" && (
              <Card className="shadow-none">
                <CardHeader className="px-4 pt-4 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Summary</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ticket types</span>
                    <span className="font-medium">{ticketTypes.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total tickets</span>
                    <span className="font-medium">{totalTickets}</span>
                  </div>
                  {totalRevenue > 0 && (
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-muted-foreground">Potential revenue</span>
                      <span className="font-semibold text-primary">₦{totalRevenue.toLocaleString()}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Progress checklist */}
            <Card className="shadow-none">
              <CardHeader className="px-4 pt-4 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Checklist</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {[
                  { label: "Title", done: !!title.trim() },
                  { label: "Cover image", done: !!(coverImage || existingCoverUrl) },
                  { label: "Product type", done: !!productType },
                  { label: "Ticket tiers", done: productType !== "event" || ticketTypes.length > 0 },
                  { label: "Event date & time", done: productType !== "event" || (!!eventDate && !!eventTime) },
                ].map(({ label, done }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${done ? "bg-emerald-500 text-white" : "border text-muted-foreground"}`}>
                      {done ? "✓" : ""}
                    </div>
                    <span className={`text-xs ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="shadow-none">
              <CardContent className="p-4 space-y-2">
                <Button onClick={handleSubmit} disabled={loading || isSubmitting} className="w-full">
                  {loading || isSubmitting ? (
                    <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />{isEditing ? "Saving..." : "Creating..."}</>
                  ) : (
                    isEditing ? "Save Changes" : "Create Product"
                  )}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => router.back()} disabled={loading || isSubmitting}>
                  Cancel
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function CreateEventPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    }>
      <CreateEventInner />
    </Suspense>
  );
}

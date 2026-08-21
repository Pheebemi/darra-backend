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
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { uploadProductFileToR2 } from "@/lib/api/upload";

interface TicketCategory {
  id: number;
  name: string;
  description: string;
  color: string;
}

interface TicketType {
  id: number;
  name: string;
  color: string;
  price: number;
  quantity: number;
}

// Quick-pick names. Tapping one fills the name box — the seller can type
// anything instead ("Table for 2", "Gold", "Twitter"), because ticket names
// belong to the event, not to a shared list.
const TICKET_NAME_PRESETS = [
  { label: "Regular", color: "#5465FF" },
  { label: "VIP", color: "#F7B500" },
  { label: "Early Bird", color: "#00B42A" },
  { label: "Table", color: "#9333EA" },
];

// Sellers list ebooks (PDF / DOCX), audio (MP3) and event tickets.
// The backend still accepts the older types (zip, video, png) so existing
// products keep working — they're just no longer offered for new listings.
const PRODUCT_TYPES = [
  { label: "eBook (PDF)", value: "pdf" },
  { label: "eBook (DOCX)", value: "docx" },
  { label: "Audio (MP3)", value: "mp3" },
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
  // "event" above is just the initial Select value, not a seller choice — the
  // AI generator needs to know the seller actually confirmed it, otherwise a
  // click before they've touched this field would describe an eBook/audio
  // upload as an event.
  const [productTypeConfirmed, setProductTypeConfirmed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);

  const [eventEndDate, setEventEndDate] = useState("");
  const [eventEndTime, setEventEndTime] = useState("");
  const [venueName, setVenueName] = useState("");
  const [location, setLocation] = useState("");
  const [speakers, setSpeakers] = useState("");

  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);
  const [newTicketName, setNewTicketName] = useState("");
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [newTicketPrice, setNewTicketPrice] = useState("");
  const [newTicketQuantity, setNewTicketQuantity] = useState("");

  const [loading, setLoading] = useState(false);
  const [fetchingProduct, setFetchingProduct] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
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
      setProductTypeConfirmed(true);

      if (data.cover_image) {
        setExistingCoverUrl(data.cover_image);
        setCoverImagePreview(data.cover_image);
      }

      if (data.event_date) {
        const dt = new Date(data.event_date);
        setEventDate(dt.toISOString().split("T")[0]);
        setEventTime(dt.toTimeString().slice(0, 5));
      }
      if (data.event_end_date) {
        const dt = new Date(data.event_end_date);
        setEventEndDate(dt.toISOString().split("T")[0]);
        setEventEndTime(dt.toTimeString().slice(0, 5));
      }
      setVenueName(data.venue_name || "");
      setLocation(data.location || "");
      setSpeakers(data.speakers || "");

      // Pre-fill ticket categories when editing. display_name already resolves
      // old generated names ("VIP_a3f9c2b1") back to something readable.
      if (data.ticket_tiers && Array.isArray(data.ticket_tiers)) {
        const mapped: TicketType[] = data.ticket_tiers.map((t: any) => ({
          id: t.id,
          name: t.display_name || t.category?.name || t.name || "Ticket",
          color: t.color || t.category?.color || "#5465FF",
          price: Number(t.price),
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
    if (f.size > 500 * 1024) { toast.error("Cover image too large. Max 500KB"); return; }
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
    const name = newTicketName.trim();
    if (!name || !newTicketPrice || !newTicketQuantity) {
      toast.error("Enter a name, price and quantity");
      return;
    }
    if (ticketTypes.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`You already have a category called "${name}"`);
      return;
    }
    const p = parseFloat(newTicketPrice);
    const q = parseInt(newTicketQuantity);
    if (p <= 0 || q <= 0) { toast.error("Price and quantity must be > 0"); return; }

    const preset = TICKET_NAME_PRESETS.find(
      (x) => x.label.toLowerCase() === name.toLowerCase()
    );
    setTicketTypes([
      ...ticketTypes,
      { id: Date.now(), name, color: preset?.color || "#5465FF", price: p, quantity: q },
    ]);
    setNewTicketName("");
    setNewTicketPrice("");
    setNewTicketQuantity("");
    toast.success(`"${name}" added`);
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

  const handleGenerateDescription = async () => {
    if (!title.trim() || isGeneratingDescription) {
      toast.error("Enter a product title first");
      return;
    }
    if (!productTypeConfirmed) {
      toast.error("Select a product type first");
      return;
    }

    setIsGeneratingDescription(true);
    try {
      const res = await fetch("/api/seller/products/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          product_type: productType,
          price: price || "0",
          // Whatever the seller has already written. Sent as the brief so the
          // model polishes their words instead of inventing from a title —
          // for an eBook or audio file it's the only real detail it gets.
          notes: description.trim(),
          event_date: eventDate && eventTime ? `${eventDate}T${eventTime}` : "",
          event_end_date: eventEndDate && eventEndTime ? `${eventEndDate}T${eventEndTime}` : "",
          venue_name: venueName.trim(),
          location: location.trim(),
          speakers: speakers.trim(),
          ticket_types: ticketTypes.map((ticket) => ({
            name: ticket.name,
            price: ticket.price,
            quantity: ticket.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to generate description");
      setDescription(data.description || "");
      toast.success("Description generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate description");
    } finally {
      setIsGeneratingDescription(false);
    }
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
        if (eventEndDate && eventEndTime) {
          const dtEnd = new Date(`${eventEndDate}T${eventEndTime}`);
          if (!isNaN(dtEnd.getTime())) formData.append("event_end_date", dtEnd.toISOString());
        }
        if (venueName.trim()) formData.append("venue_name", venueName.trim());
        if (location.trim()) formData.append("location", location.trim());
        if (speakers.trim()) formData.append("speakers", speakers.trim());
        formData.append(
          "ticket_types",
          JSON.stringify(ticketTypes.map((t) => ({
            name: t.name,
            color: t.color,
            price: t.price,
            quantity: t.quantity,
          })))
        );
      } else if (file) {
        // Upload the file straight to R2 (bypasses the 4.5MB proxy limit) and
        // send only its key. Falls back to a normal upload when R2 isn't
        // configured on the server (local dev / small files).
        setUploadPct(0);
        const key = await uploadProductFileToR2(file, productType, setUploadPct);
        setUploadPct(null);
        if (key) formData.append("file_key", key);
        else formData.append("file", file);
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
      setUploadPct(null);
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
      <div className="mx-auto max-w-5xl p-6 sm:p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-body transition-colors hover:text-accent-link"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent-link">Catalog</p>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
            {isEditing ? "Edit Product" : "Add Product"}
          </h1>
          <p className="mt-1 text-sm text-body">
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
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-softer">
                        <Settings className="h-5 w-5 text-accent-link" />
                      </div>
                      <CardTitle className="text-lg font-semibold text-ink">Basic Information</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="title" className="text-sm font-medium text-strong">Title *</Label>
                      <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product title" className="h-11" />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="productType" className="text-sm font-medium text-strong">Product Type</Label>
                        <Select
                          value={productType}
                          onValueChange={(value) => { setProductType(value); setProductTypeConfirmed(true); }}
                        >
                          <SelectTrigger className="h-11 w-full">
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
                          <Label htmlFor="price" className="text-sm font-medium text-strong">Price (₦)</Label>
                          <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" step="0.01" min="0" className="h-11" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="description" className="text-sm font-medium text-strong">Description</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateDescription}
                          disabled={isGeneratingDescription || !title.trim() || !productTypeConfirmed}
                          title={
                            !productTypeConfirmed
                              ? "Select a product type first"
                              : description.trim()
                                ? "Rewrite what you've written into polished copy"
                                : "Generate a description with AI"
                          }
                        >
                          {isGeneratingDescription ? <Loader2 className="animate-spin" /> : <Sparkles />}
                          {isGeneratingDescription
                            ? "Generating..."
                            : description.trim()
                              ? "Rewrite with AI"
                              : "Generate with AI"}
                        </Button>
                      </div>
                      <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your product..." rows={4} />
                      {/* A title attribute on a disabled button is easy to
                          miss, so say why it's inactive in the open. */}
                      {!productTypeConfirmed && !!title.trim() ? (
                        <p className="text-xs text-faint">
                          Pick a product type above to enable AI descriptions.
                        </p>
                      ) : (
                        !!description.trim() && (
                          <p className="text-xs text-faint">
                            AI will rewrite what you&apos;ve written, keeping your facts.
                          </p>
                        )
                      )}
                    </div>

                    {productType === "event" && (
                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="eventDate" className="text-sm font-medium text-strong">Start Date *</Label>
                            <Input id="eventDate" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="h-11" />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="eventTime" className="text-sm font-medium text-strong">Start Time *</Label>
                            <Input id="eventTime" type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="h-11" />
                          </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="eventEndDate" className="text-sm font-medium text-strong">End Date</Label>
                            <Input id="eventEndDate" type="date" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} min={eventDate || new Date().toISOString().split("T")[0]} className="h-11" />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="eventEndTime" className="text-sm font-medium text-strong">End Time</Label>
                            <Input id="eventEndTime" type="time" value={eventEndTime} onChange={(e) => setEventEndTime(e.target.value)} className="h-11" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="venueName" className="text-sm font-medium text-strong">Venue Name</Label>
                          <Input id="venueName" value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="e.g. Taraba State Event Centre" className="h-11" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="location" className="text-sm font-medium text-strong">Address / Location</Label>
                          <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Jalingo, Taraba State, Nigeria" className="h-11" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="speakers" className="text-sm font-medium text-strong">Speakers / Guests</Label>
                          <Textarea id="speakers" value={speakers} onChange={(e) => setSpeakers(e.target.value)} placeholder={"One speaker per line:\nJohn Doe\nJane Smith"} rows={3} />
                          <p className="text-[11px] text-muted-foreground">Enter one speaker or guest per line</p>
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
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-softer">
                        <Ticket className="h-5 w-5 text-accent-link" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold text-ink">Ticket Configuration</CardTitle>
                        <CardDescription className="text-sm text-body">Add ticket tiers with different prices and quantities</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add form */}
                    <div className="space-y-3 rounded-2xl bg-brand-soft p-4">
                      <p className="text-xs font-medium">Add Ticket Type</p>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium text-strong">Category name *</Label>
                        <Input
                          value={newTicketName}
                          onChange={(e) => setNewTicketName(e.target.value)}
                          placeholder="e.g. Regular, VIP, Table for 2"
                          maxLength={100}
                          className="h-11"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); addTicketType(); }
                          }}
                        />
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {TICKET_NAME_PRESETS.map((p) => (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => setNewTicketName(p.label)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-2.5 py-1 text-xs text-body transition-colors hover:border-brand-300 hover:bg-brand-soft"
                            >
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                              {p.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-subtle">
                          Name these however you like — they only apply to this event.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium text-strong">Price (₦) *</Label>
                          <Input type="number" value={newTicketPrice} onChange={(e) => setNewTicketPrice(e.target.value)} placeholder="0.00" min="0" step="0.01" className="h-11" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-medium text-strong">Quantity *</Label>
                          <Input type="number" value={newTicketQuantity} onChange={(e) => setNewTicketQuantity(e.target.value)} placeholder="0" min="1" className="h-11" />
                        </div>
                      </div>
                      <Button size="sm" className="w-full h-8 text-xs" onClick={addTicketType} disabled={!newTicketName.trim() || !newTicketPrice || !newTicketQuantity}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />Add Category
                      </Button>
                    </div>

                    {/* Existing types */}
                    {ticketTypes.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Ticket Types ({ticketTypes.length})</p>
                        {ticketTypes.map((t) => (
                          <div key={t.id} className="flex items-center justify-between rounded-2xl border border-line bg-page-soft p-4">
                            <div className="flex items-center gap-3">
                              <Badge className="text-[10px]" style={{ backgroundColor: t.color }}>{t.name}</Badge>
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
                      <div className="rounded-2xl border border-dashed border-brand-200 py-8 text-center">
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
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-softer">
                        <ImageIcon className="h-5 w-5 text-accent-link" />
                      </div>
                      <CardTitle className="text-lg font-semibold text-ink">Media & Files</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Cover image */}
                    <div className="space-y-2">
                      <div>
                        <Label className="text-sm font-medium text-strong">Cover Image {!isEditing && "*"}</Label>
                        <p className="text-xs text-body">16:9 recommended · max 500KB</p>
                      </div>
                      {/* Dropzone-style preview/upload */}
                      <label className="relative block cursor-pointer">
                        <input type="file" accept="image/*" onChange={handleCoverImageChange} className="sr-only" />
                        <div className="relative h-44 w-full overflow-hidden rounded-2xl border-2 border-dashed border-brand-200 bg-brand-soft/50 transition-colors hover:border-brand-400 hover:bg-brand-soft">
                          {coverImagePreview ? (
                            <img src={coverImagePreview} alt="Preview" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-2">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-softer">
                                <ImageIcon className="h-6 w-6 text-accent-link" />
                              </div>
                              <p className="text-sm font-medium text-ink">Click to upload cover image</p>
                              <p className="text-xs text-subtle">JPG or PNG · up to 500KB</p>
                            </div>
                          )}
                          {coverImagePreview && (
                            <span className="absolute bottom-2 right-2 rounded-full bg-ink/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                              Change
                            </span>
                          )}
                        </div>
                      </label>
                      {coverImagePreview && (
                        <button
                          type="button"
                          className="text-xs font-medium text-err hover:underline"
                          onClick={() => { setCoverImage(null); setCoverImagePreview(null); setExistingCoverUrl(null); }}
                        >
                          Remove image
                        </button>
                      )}
                      {isEditing && existingCoverUrl && !coverImage && (
                        <p className="text-xs text-muted-foreground">Current image shown above. Upload a new one to replace it.</p>
                      )}
                    </div>

                    {/* Product file */}
                    {productType !== "event" && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-strong">Product File {!isEditing && "*"}</Label>
                        <Input
                          type="file"
                          onChange={handleFileChange}
                          accept={productType === "pdf" ? ".pdf" : productType === "docx" ? ".docx" : productType === "mp3" ? ".mp3,audio/mpeg" : "*"}
                          className="h-9 cursor-pointer text-xs"
                        />
                        {file && (
                          <div className="flex items-center gap-2 rounded-xl bg-brand-soft px-3 py-2">
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
                    <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${done ? "bg-brand-500 text-white" : "border border-line-strong text-faint"}`}>
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
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      {uploadPct !== null
                        ? `Uploading file... ${uploadPct}%`
                        : isEditing ? "Saving..." : "Creating..."}
                    </>
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

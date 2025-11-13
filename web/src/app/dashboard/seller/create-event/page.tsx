"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  ArrowLeft,
  Calendar,
  Upload,
  X,
  Plus,
  Trash2,
  Loader2,
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
  { label: "Event/Ticket", value: "event" },
];

export default function CreateEventPage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [productType, setProductType] = useState("event");
  const [file, setFile] = useState<File | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(
    null
  );

  // Ticket system state
  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>(
    []
  );
  const [selectedTicketCategory, setSelectedTicketCategory] = useState<
    number | null
  >(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [newTicketPrice, setNewTicketPrice] = useState("");
  const [newTicketQuantity, setNewTicketQuantity] = useState("");

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadTicketCategories();
    }
  }, [isAuthenticated]);

  const loadTicketCategories = async () => {
    try {
      setCategoriesLoading(true);
      const response = await fetch("/api/ticket-categories");
      if (response.ok) {
        const data = await response.json();
        setTicketCategories(data);
      }
    } catch (error) {
      console.error("Failed to load ticket categories:", error);
      toast.error("Failed to load ticket categories");
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error("File size too large. Maximum allowed size is 50MB.");
        return;
      }
      setFile(file);
    }
  };

  const addTicketType = () => {
    if (!selectedTicketCategory || !newTicketPrice || !newTicketQuantity) {
      toast.error("Please select category and fill price and quantity");
      return;
    }

    const selectedCategory = ticketCategories.find(
      (cat) => cat.id === selectedTicketCategory
    );
    if (!selectedCategory) return;

    const newTicketType: TicketType = {
      id: Date.now(),
      category: selectedCategory,
      price: parseFloat(newTicketPrice),
      quantity: parseInt(newTicketQuantity),
    };

    setTicketTypes([...ticketTypes, newTicketType]);

    // Reset form
    setNewTicketPrice("");
    setNewTicketQuantity("");
    setSelectedTicketCategory(null);

    toast.success("Ticket type added! Add more or create the event.");
  };

  const removeTicketType = (ticketTypeId: number) => {
    setTicketTypes(ticketTypes.filter((type) => type.id !== ticketTypeId));
  };

  const handleSubmit = async () => {
    if (!title || !productType) {
      toast.error("Please fill all required fields");
      return;
    }

    if (productType === "event") {
      if (!eventDate || !eventTime) {
        toast.error("Please provide event date and time");
        return;
      }

      if (ticketTypes.length === 0) {
        toast.error("Please add at least one ticket type");
        return;
      }
    } else {
      if (!file) {
        toast.error("Please upload a file");
        return;
      }
    }

    if (!coverImage) {
      toast.error("Please select a cover image");
      return;
    }

    // Prevent duplicate submissions
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("description_html", description);
      formData.append("price", price || "0");
      formData.append("product_type", productType);

      if (productType === "event") {
        // Combine date and time - ensure we have both
        if (!eventDate || !eventTime) {
          toast.error("Please provide both event date and time");
          setIsSubmitting(false);
          setLoading(false);
          return;
        }
        
        // Combine date and time strings and create a Date object
        // Format: YYYY-MM-DDTHH:mm (local time)
        const dateTimeString = `${eventDate}T${eventTime}`;
        const dateTime = new Date(dateTimeString);
        
        // Validate the date
        if (isNaN(dateTime.getTime())) {
          toast.error("Invalid date or time format");
          setIsSubmitting(false);
          setLoading(false);
          return;
        }
        
        // Send as ISO string (backend expects ISO 8601 format)
        formData.append("event_date", dateTime.toISOString());

        // Add ticket types data
        formData.append(
          "ticket_types",
          JSON.stringify(
            ticketTypes.map((type) => ({
              category_id: type.category.id,
              price: type.price,
              quantity: type.quantity,
            }))
          )
        );
      } else if (file) {
        formData.append("file", file);
      }

      if (coverImage) {
        formData.append("cover_image", coverImage);
      }

      const response = await fetch("/api/seller/products", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create product");
      }

      toast.success("Event created successfully!");
      setTimeout(() => {
        router.push("/dashboard/seller");
      }, 1500);
    } catch (error: any) {
      console.error("Error creating product:", error);
      toast.error(error.message || "Failed to create event");
    } finally {
      setLoading(false);
      setIsSubmitting(false);
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
  if (userType !== "seller") {
    router.push("/dashboard/buyer");
    return null;
  }

  const totalTickets = ticketTypes.reduce(
    (total, type) => total + type.quantity,
    0
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl px-6 py-8">
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
                Create Event
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a new event and start selling tickets
              </p>
            </div>
          </div>
        </div>

        {/* Product Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter event title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter event description..."
                rows={4}
              />
            </div>

            {productType !== "event" && (
              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Enter price"
                  step="0.01"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="productType">Type</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product type" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>
                      {pt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="coverImage">Cover Image *</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="coverImage"
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageChange}
                  className="cursor-pointer"
                />
                {coverImagePreview && (
                  <div className="relative h-20 w-20">
                    <img
                      src={coverImagePreview}
                      alt="Cover preview"
                      className="h-full w-full rounded-lg object-cover"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-destructive p-0 text-white hover:bg-destructive/90"
                      onClick={() => {
                        setCoverImage(null);
                        setCoverImagePreview(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ticket System Fields */}
        {productType === "event" && (
          <>
            {/* Ticket Types Management */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Ticket Types</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Add different ticket categories with their prices and
                  quantities
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Live Total Display */}
                {ticketTypes.length > 0 && (
                  <div className="rounded-lg border bg-primary/10 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Current Total:</span>
                      <span className="text-lg font-bold text-primary">
                        {totalTickets} tickets
                      </span>
                    </div>
                  </div>
                )}

                {/* Add New Ticket Type Form */}
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="space-y-2">
                    <Label htmlFor="ticketCategory">Select Category</Label>
                    {categoriesLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Select
                        value={selectedTicketCategory?.toString() || ""}
                        onValueChange={(value) =>
                          setSelectedTicketCategory(parseInt(value))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {ticketCategories.map((category) => (
                            <SelectItem
                              key={category.id}
                              value={category.id.toString()}
                            >
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ticketPrice">Price (₦)</Label>
                      <Input
                        id="ticketPrice"
                        type="number"
                        value={newTicketPrice}
                        onChange={(e) => setNewTicketPrice(e.target.value)}
                        placeholder="Enter price"
                        step="0.01"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ticketQuantity">Quantity Available</Label>
                      <Input
                        id="ticketQuantity"
                        type="number"
                        value={newTicketQuantity}
                        onChange={(e) => setNewTicketQuantity(e.target.value)}
                        placeholder="Enter quantity"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={addTicketType}
                    disabled={
                      !selectedTicketCategory ||
                      !newTicketPrice ||
                      !newTicketQuantity
                    }
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Ticket Type
                  </Button>
                </div>

                {/* Display Added Ticket Types */}
                {ticketTypes.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Added Ticket Types:</h3>
                    {ticketTypes.map((ticketType) => (
                      <div
                        key={ticketType.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              style={{
                                backgroundColor: ticketType.category.color,
                              }}
                            >
                              {ticketType.category.name}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center gap-4">
                            <span className="text-lg font-bold">
                              ₦{ticketType.price}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              Quantity: {ticketType.quantity}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTicketType(ticketType.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Event Details */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="eventDate">Event Date *</Label>
                    <Input
                      id="eventDate"
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="eventTime">Event Time *</Label>
                    <Input
                      id="eventTime"
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Total Ticket Quantity</Label>
                  <div className="rounded-lg border-2 border-primary/40 bg-primary/10 p-4 text-center">
                    <span className="text-2xl font-bold text-primary">
                      {totalTickets} tickets
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Automatically calculated from your ticket types above
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* File Upload for Non-Event Products */}
        {productType !== "event" && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Upload File</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="file">File *</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileChange}
                  accept={
                    productType === "pdf"
                      ? ".pdf"
                      : productType === "mp3"
                      ? ".mp3"
                      : productType === "docx"
                      ? ".docx"
                      : productType === "zip"
                      ? ".zip"
                      : productType === "video"
                      ? "video/*"
                      : "*"
                  }
                  className="cursor-pointer"
                />
                {file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {file.name}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Button */}
        <div className="flex gap-4">
          <Button
            onClick={handleSubmit}
            disabled={loading || isSubmitting}
            className="flex-1"
            size="lg"
          >
            {loading || isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Event...
              </>
            ) : (
              "Create Event"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={loading || isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}


"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Calendar,
  Upload,
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
  { label: "PDF", value: "pdf", icon: FileText },
  { label: "MP3", value: "mp3", icon: FileText },
  { label: "DOCX", value: "docx", icon: FileText },
  { label: "ZIP", value: "zip", icon: FileText },
  { label: "Video", value: "video", icon: FileText },
  { label: "Event/Ticket", value: "event", icon: Ticket },
];

export default function CreateEventPage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();

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

  // Ticket system state
  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);
  const [selectedTicketCategory, setSelectedTicketCategory] = useState<number | null>(null);
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
      // Validate image type
      if (!file.type.startsWith('image/')) {
        toast.error("Please select a valid image file");
        return;
      }
      
      // Validate file size (max 5MB for images)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size too large. Maximum allowed size is 5MB.");
        return;
      }
      
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

    const priceValue = parseFloat(newTicketPrice);
    const quantityValue = parseInt(newTicketQuantity);

    if (priceValue <= 0 || quantityValue <= 0) {
      toast.error("Price and quantity must be greater than 0");
      return;
    }

    const newTicketType: TicketType = {
      id: Date.now(),
      category: selectedCategory,
      price: priceValue,
      quantity: quantityValue,
    };

    setTicketTypes([...ticketTypes, newTicketType]);

    // Reset form
    setNewTicketPrice("");
    setNewTicketQuantity("");
    setSelectedTicketCategory(null);

    toast.success("Ticket type added!");
  };

  const removeTicketType = (ticketTypeId: number) => {
    setTicketTypes(ticketTypes.filter((type) => type.id !== ticketTypeId));
    toast.success("Ticket type removed");
  };

  const validateForm = () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return false;
    }

    if (!coverImage) {
      toast.error("Please select a cover image");
      return false;
    }

    if (productType === "event") {
      if (!eventDate || !eventTime) {
        toast.error("Please provide event date and time");
        return false;
      }

      if (ticketTypes.length === 0) {
        toast.error("Please add at least one ticket type");
        return false;
      }

      // Validate event date is in the future
      const eventDateTime = new Date(`${eventDate}T${eventTime}`);
      if (eventDateTime <= new Date()) {
        toast.error("Event date and time must be in the future");
        return false;
      }
    } else {
      if (!file) {
        toast.error("Please upload a file");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Prevent duplicate submissions
    if (isSubmitting) {
      return;
    }

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
        const dateTimeString = `${eventDate}T${eventTime}`;
        const dateTime = new Date(dateTimeString);
        
        if (isNaN(dateTime.getTime())) {
          toast.error("Invalid date or time format");
          return;
        }
        
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
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-foreground/70">Loading...</p>
        </div>
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

  const totalRevenue = ticketTypes.reduce(
    (total, type) => total + (type.price * type.quantity),
    0
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild className="hover:bg-accent">
              <Link href="/dashboard/seller">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
          </div>
          <div className="mt-4">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Create New Event
            </h1>
            <p className="mt-2 text-muted-foreground">
              Set up your event details, tickets, and pricing
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Details
                </TabsTrigger>
                <TabsTrigger 
                  value="tickets" 
                  className="flex items-center gap-2"
                  disabled={productType !== "event"}
                >
                  <Ticket className="h-4 w-4" />
                  Tickets
                </TabsTrigger>
                <TabsTrigger value="media" className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Media
                </TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                    <CardDescription>
                      Provide the essential details about your event
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Event Title *</Label>
                      <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter event title"
                        className="text-lg"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your event to attract attendees..."
                        rows={5}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="productType">Product Type</Label>
                        <Select value={productType} onValueChange={setProductType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select product type" />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCT_TYPES.map((pt) => {
                              const IconComponent = pt.icon;
                              return (
                                <SelectItem key={pt.value} value={pt.value}>
                                  <div className="flex items-center gap-2">
                                    <IconComponent className="h-4 w-4" />
                                    {pt.label}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      {productType !== "event" && (
                        <div className="space-y-2">
                          <Label htmlFor="price">Price (₦)</Label>
                          <Input
                            id="price"
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                          />
                        </div>
                      )}
                    </div>

                    {productType === "event" && (
                      <div className="grid gap-4 sm:grid-cols-2">
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
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tickets Tab */}
              <TabsContent value="tickets" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Ticket Configuration</CardTitle>
                    <CardDescription>
                      Set up different ticket types with prices and quantities
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Add Ticket Form */}
                    <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
                      <h3 className="font-semibold">Add New Ticket Type</h3>
                      
                      <div className="space-y-2">
                        <Label>Category</Label>
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
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="h-3 w-3 rounded-full"
                                      style={{ backgroundColor: category.color }}
                                    />
                                    {category.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="ticketPrice">Price (₦) *</Label>
                          <Input
                            id="ticketPrice"
                            type="number"
                            value={newTicketPrice}
                            onChange={(e) => setNewTicketPrice(e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="ticketQuantity">Quantity *</Label>
                          <Input
                            id="ticketQuantity"
                            type="number"
                            value={newTicketQuantity}
                            onChange={(e) => setNewTicketQuantity(e.target.value)}
                            placeholder="0"
                            min="1"
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

                    {/* Ticket Types List */}
                    {ticketTypes.length > 0 ? (
                      <div className="space-y-4">
                        <h3 className="font-semibold">Current Ticket Types</h3>
                        <div className="space-y-3">
                          {ticketTypes.map((ticketType) => (
                            <div
                              key={ticketType.id}
                              className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-4">
                                <Badge
                                  className="px-3 py-1"
                                  style={{
                                    backgroundColor: ticketType.category.color,
                                  }}
                                >
                                  {ticketType.category.name}
                                </Badge>
                                <div className="flex items-center gap-6">
                                  <div>
                                    <p className="text-2xl font-bold text-foreground">
                                      ₦{ticketType.price.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      per ticket
                                    </p>
                                  </div>
                                  <div className="h-8 w-px bg-border" />
                                  <div>
                                    <p className="text-lg font-semibold">
                                      {ticketType.quantity}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      available
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeTicketType(ticketType.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed rounded-lg">
                        <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No ticket types added yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Add your first ticket type to get started
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Media Tab */}
              <TabsContent value="media" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Media & Files</CardTitle>
                    <CardDescription>
                      Upload cover image and event files
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Cover Image Upload */}
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="coverImage">Cover Image *</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Recommended: 16:9 ratio, max 5MB
                        </p>
                      </div>
                      
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <Input
                          id="coverImage"
                          type="file"
                          accept="image/*"
                          onChange={handleCoverImageChange}
                          className="cursor-pointer flex-1"
                        />
                        {coverImagePreview && (
                          <div className="relative h-24 w-24 flex-shrink-0">
                            <img
                              src={coverImagePreview}
                              alt="Cover preview"
                              className="h-full w-full rounded-lg object-cover border"
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
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* File Upload for Non-Event Products */}
                    {productType !== "event" && (
                      <div className="space-y-2">
                        <Label htmlFor="file">Product File *</Label>
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
                          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setFile(null)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle>Event Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Tickets</span>
                    <span className="font-semibold">{totalTickets}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Ticket Types</span>
                    <span className="font-semibold">{ticketTypes.length}</span>
                  </div>
                  {productType === "event" && totalRevenue > 0 && (
                    <div className="flex justify-between border-t pt-3">
                      <span className="text-sm font-medium">Potential Revenue</span>
                      <span className="font-bold text-primary">
                        ₦{totalRevenue.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Progress Card */}
            <Card>
              <CardHeader>
                <CardTitle>Creation Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {[
                    { label: "Basic Details", completed: !!title.trim() && !!coverImage },
                    { label: "Event Type", completed: !!productType },
                    { 
                      label: "Ticket Setup", 
                      completed: productType !== "event" || ticketTypes.length > 0 
                    },
                    { 
                      label: "Event Timing", 
                      completed: productType !== "event" || (!!eventDate && !!eventTime) 
                    },
                  ].map((step, index) => (
                    <div key={step.label} className="flex items-center gap-3">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                          step.completed
                            ? "bg-green-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {step.completed ? "✓" : index + 1}
                      </div>
                      <span
                        className={`text-sm ${
                          step.completed ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Actions Card */}
            <Card>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Button
                    onClick={handleSubmit}
                    disabled={loading || isSubmitting}
                    className="w-full"
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
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
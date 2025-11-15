"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Html5Qrcode } from "html5-qrcode";
import {
  ArrowLeft,
  QrCode,
  Camera,
  X,
  CheckCircle2,
  XCircle,
  User,
  Calendar,
  ShoppingCart,
  CreditCard,
  DollarSign,
  Ticket,
  Keyboard,
  Scan,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface TicketBuyer {
  full_name: string;
  email: string;
}

interface TicketEvent {
  title: string;
  event_date: string;
  description?: string;
}

interface TicketVerifier {
  full_name: string;
}

interface TicketDetails {
  ticket_id: string;
  buyer: TicketBuyer;
  event: TicketEvent;
  quantity: number;
  is_used: boolean;
  used_at: string | null;
  verified_by: TicketVerifier | null;
  verified_at: string | null;
  created_at: string;
  purchase_reference: string;
  payment_amount: string;
  qr_code_url?: string;
  pdf_ticket_url?: string;
  ticket_tier?: {
    name: string;
    price: string;
    category: {
      name: string;
      color: string;
    };
  };
}

export default function VerifyTicketsPage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [ticketDetails, setTicketDetails] = useState<TicketDetails | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualTicketId, setManualTicketId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    // Cleanup scanner on unmount
    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current = null;
          })
          .catch((err) => {
            console.error("Error stopping scanner:", err);
          });
      }
    };
  }, []);

  const startScanning = async () => {
    try {
      setScanning(true);
      setScanned(false);

      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleQRCodeScanned(decodedText);
        },
        (errorMessage) => {
          // Ignore scanning errors, just keep scanning
        }
      );
    } catch (error: any) {
      console.error("Error starting scanner:", error);
      toast.error("Failed to start camera. Please check permissions.");
      setScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
    }
    setScanning(false);
    setScanned(false);
  };

  const handleQRCodeScanned = async (data: string) => {
    if (scanned) return;

    setScanned(true);
    await stopScanning();

    try {
      // Parse the scanned QR code data to extract ticket_id
      let ticketId: string;
      try {
        const parsedData = JSON.parse(data);
        ticketId = parsedData.ticket_id;
        if (!ticketId) {
          throw new Error("No ticket_id found in QR code data");
        }
      } catch (parseError) {
        // If parsing fails, assume the data is directly the ticket_id
        ticketId = data;
      }

      await fetchTicketDetails(ticketId);
    } catch (error: any) {
      console.error("Error processing QR code:", error);
      toast.error("Failed to process QR code. Please try again.");
      setScanned(false);
    }
  };

  const fetchTicketDetails = async (ticketId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/seller/tickets/${ticketId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ticket not found");
      }
      const data = await response.json();
      setTicketDetails(data);
      setShowTicketModal(true);
      setShowManualEntry(false);
    } catch (error: any) {
      console.error("Error fetching ticket details:", error);
      toast.error(error.message || "Failed to fetch ticket details");
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const handleManualVerify = async () => {
    if (!manualTicketId.trim()) {
      toast.error("Please enter a ticket ID");
      return;
    }

    await fetchTicketDetails(manualTicketId.trim());
    setManualTicketId("");
  };

  const verifyTicket = async () => {
    if (!ticketDetails) return;

    setVerifying(true);
    try {
      const response = await fetch(
        `/api/seller/tickets/${ticketDetails.ticket_id}/verify`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to verify ticket");
      }

      const data = await response.json();
      toast.success("Ticket verified successfully!");
      
      // Update ticket details with verified info
      if (data.ticket) {
        setTicketDetails(data.ticket);
      }
    } catch (error: any) {
      console.error("Error verifying ticket:", error);
      toast.error(error.message || "Failed to verify ticket");
    } finally {
      setVerifying(false);
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setTicketDetails(null);
    setShowTicketModal(false);
    setShowManualEntry(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return "₦0";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount);
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
                Verify Tickets
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Scan QR codes to verify event tickets
              </p>
            </div>
          </div>
        </div>

        {/* Scanner Section */}
        {!scanning && !scanned && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="mb-8 flex flex-col items-center">
                <QrCode className="mb-4 h-24 w-24 text-primary" />
                <h2 className="mb-2 text-2xl font-semibold">Ready to scan</h2>
                <p className="text-center text-muted-foreground">
                  Point camera at a ticket QR code
                </p>
              </div>

              <div className="flex w-full max-w-md flex-col gap-4">
                <Button onClick={startScanning} size="lg" className="w-full">
                  <Camera className="mr-2 h-5 w-5" />
                  Start Scanning
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setShowManualEntry(true)}
                  size="lg"
                  className="w-full"
                >
                  <Keyboard className="mr-2 h-5 w-5" />
                  Enter Ticket ID Manually
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scanning View */}
        {scanning && (
          <Card>
            <CardContent className="p-6">
              <div className="relative">
                <div id="qr-reader" className="w-full rounded-lg" />
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="border-2 border-primary rounded-lg w-64 h-64" />
                </div>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Position QR code within frame
                </p>
              </div>
              <Button
                onClick={stopScanning}
                variant="destructive"
                className="mt-4 w-full"
              >
                <X className="mr-2 h-4 w-4" />
                Stop Scanning
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Manual Entry Dialog */}
        <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enter Ticket ID</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ticketId">Ticket ID</Label>
                <Input
                  id="ticketId"
                  placeholder="Enter ticket ID..."
                  value={manualTicketId}
                  onChange={(e) => setManualTicketId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleManualVerify();
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowManualEntry(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleManualVerify}
                  disabled={loading || !manualTicketId.trim()}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Verify"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Ticket Details Modal */}
        <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ticket Details</DialogTitle>
            </DialogHeader>

            {ticketDetails && (
              <div className="space-y-6">
                {/* Event Information */}
                <div>
                  <h3 className="mb-3 text-lg font-semibold">
                    Event Information
                  </h3>
                  <div className="space-y-2 rounded-lg border p-4">
                    <h4 className="text-xl font-bold">
                      {ticketDetails.event.title}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(ticketDetails.event.event_date)}
                    </p>
                  </div>
                </div>

                {/* Buyer Information */}
                <div>
                  <h3 className="mb-3 text-lg font-semibold">
                    Buyer Information
                  </h3>
                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {ticketDetails.buyer.full_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {ticketDetails.buyer.email}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ticket Information */}
                <div>
                  <h3 className="mb-3 text-lg font-semibold">
                    Ticket Information
                  </h3>
                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Ticket ID:
                      </span>
                      <span className="font-mono text-sm font-medium">
                        {ticketDetails.ticket_id}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Quantity:
                      </span>
                      <span className="font-medium">
                        {ticketDetails.quantity}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Status:
                      </span>
                      <Badge
                        className={
                          ticketDetails.is_used
                            ? "bg-red-500"
                            : "bg-green-500"
                        }
                      >
                        {ticketDetails.is_used ? (
                          <XCircle className="mr-1 h-3 w-3" />
                        ) : (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        )}
                        {ticketDetails.is_used ? "Used" : "Valid"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Reference:
                      </span>
                      <span className="font-mono text-sm font-medium">
                        {ticketDetails.purchase_reference}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Amount:
                      </span>
                      <span className="font-bold text-primary">
                        {formatCurrency(ticketDetails.payment_amount)}
                      </span>
                    </div>

                    {ticketDetails.ticket_tier && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Category:
                          </span>
                          <Badge
                            variant="secondary"
                            style={{
                              backgroundColor: `${ticketDetails.ticket_tier.category.color}20`,
                              color: ticketDetails.ticket_tier.category.color,
                            }}
                          >
                            {ticketDetails.ticket_tier.category.name}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Ticket Tier:
                          </span>
                          <span className="font-medium">
                            {ticketDetails.ticket_tier.name}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Usage Information */}
                {ticketDetails.is_used && (
                  <div>
                    <h3 className="mb-3 text-lg font-semibold">
                      Usage Information
                    </h3>
                    <div className="space-y-2 rounded-lg border p-4">
                      {ticketDetails.used_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Used at:
                          </span>
                          <span className="text-sm font-medium">
                            {formatDate(ticketDetails.used_at)}
                          </span>
                        </div>
                      )}
                      {ticketDetails.verified_by && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Verified by:
                          </span>
                          <span className="text-sm font-medium">
                            {ticketDetails.verified_by.full_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowTicketModal(false);
                      resetScanner();
                    }}
                    className="flex-1"
                  >
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetScanner();
                      startScanning();
                    }}
                    className="flex-1"
                  >
                    <Scan className="mr-2 h-4 w-4" />
                    Scan Again
                  </Button>
                  {!ticketDetails.is_used && (
                    <Button
                      onClick={verifyTicket}
                      disabled={verifying}
                      className="flex-1"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify Ticket"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}


"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
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
    if (initialized && isAuthenticated && user) {
      const userType = (user.user_type || "buyer").toLowerCase();
      if (userType !== "seller") router.push("/dashboard/buyer");
    }
  }, [isAuthenticated, initialized, user, router]);

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

      // Check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Camera is not supported in this browser");
        setScanning(false);
        return;
      }

      // Request camera permissions first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        // Stop the stream immediately, we just needed permission
        stream.getTracks().forEach((track) => track.stop());
      } catch (permissionError: any) {
        console.error("Camera permission error:", permissionError);
        if (permissionError.name === "NotAllowedError") {
          toast.error(
            "Camera access denied. Please allow camera access in your browser settings and try again."
          );
        } else if (permissionError.name === "NotFoundError") {
          toast.error("No camera found on this device");
        } else {
          toast.error("Failed to access camera. Please check your browser settings.");
        }
        setScanning(false);
        return;
      }

      // Now start the QR scanner
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
      
      // Clean up if scanner was created
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (stopError) {
          // Ignore stop errors
        }
        scannerRef.current = null;
      }

      // Provide specific error messages
      if (error.name === "NotAllowedError" || error.message?.includes("permission")) {
        toast.error(
          "Camera access denied. Please allow camera access in your browser settings."
        );
      } else if (error.name === "NotFoundError" || error.message?.includes("camera")) {
        toast.error("No camera found on this device");
      } else {
        toast.error(
          error.message || "Failed to start camera. Please check permissions and try again."
        );
      }
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
  if (initialized && userType !== "seller") return null;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-500">Events</p>
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
              Verify Tickets
            </h1>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/seller">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        {/* Scanner Section */}
        {!scanning && !scanned && (
          <div className="rounded-3xl bg-brand-950 p-8 sm:p-12">
            <div className="flex flex-col items-center">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-brand-500/20">
                <QrCode className="h-12 w-12 text-brand-300" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">Ready to scan</h2>
              <p className="mb-8 text-center text-brand-200">
                Point camera at a ticket QR code
              </p>

              <div className="flex w-full max-w-md flex-col gap-3">
                <button
                  onClick={startScanning}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-8 py-4 text-lg font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300"
                >
                  <Camera className="h-5 w-5" />
                  Start Scanning
                </button>

                <button
                  onClick={() => setShowManualEntry(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-300/40 px-6 py-3 font-medium text-brand-100 transition-colors hover:bg-white/10"
                >
                  <Keyboard className="h-5 w-5" />
                  Enter Ticket ID Manually
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scanning View */}
        {scanning && (
          <div className="rounded-3xl border border-gray-100 bg-white p-6">
            <div className="relative">
              <div id="qr-reader" className="w-full overflow-hidden rounded-2xl" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-64 w-64 rounded-2xl border-2 border-brand-500" />
              </div>
              <p className="mt-4 text-center text-sm text-gray-600">
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
          </div>
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
                  <div className="space-y-2 rounded-2xl border border-gray-100 p-4">
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
                  <div className="space-y-2 rounded-2xl border border-gray-100 p-4">
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
                  <div className="space-y-3 rounded-2xl border border-gray-100 p-4">
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
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                        ticketDetails.is_used
                          ? "bg-red-50 text-[#b3261e]"
                          : "bg-[#EBFBF0] text-[#00B42A]"
                      }`}>
                        {ticketDetails.is_used ? (
                          <XCircle className="mr-1 h-3 w-3" />
                        ) : (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        )}
                        {ticketDetails.is_used ? "Used" : "Valid"}
                      </span>
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
                    <div className="space-y-2 rounded-2xl border border-gray-100 p-4">
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


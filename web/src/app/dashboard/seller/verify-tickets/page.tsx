"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    // Seller-named categories have these; older rows fall back to `category`.
    display_name?: string;
    color?: string;
    category?: {
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
          <div className="overflow-hidden rounded-3xl bg-brand-950 p-6 sm:p-8">
            {/* Status row */}
            <div className="mb-5 flex items-center justify-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-400" />
              </span>
              <p className="text-sm font-medium text-brand-100">Camera active — looking for a QR code</p>
            </div>

            {/* Camera viewport */}
            <div className="relative mx-auto max-w-md">
              <div id="qr-reader" className="w-full overflow-hidden rounded-2xl [&_video]:rounded-2xl" />
              {/* Corner brackets */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-56 w-56">
                  <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-brand-400" />
                  <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-brand-400" />
                  <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-brand-400" />
                  <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-brand-400" />
                </div>
              </div>
            </div>

            <p className="mt-5 text-center text-sm text-brand-200">
              Position the ticket's QR code inside the frame
            </p>

            <div className="mx-auto mt-5 flex max-w-md flex-col gap-2">
              <button
                onClick={stopScanning}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/10 px-6 py-3 font-medium text-white transition-colors hover:bg-white/20"
              >
                <X className="h-4 w-4" />
                Stop Scanning
              </button>
              <button
                onClick={() => { stopScanning(); setShowManualEntry(true); }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-medium text-brand-200 transition-colors hover:text-white"
              >
                <Keyboard className="h-4 w-4" />
                Enter ID manually instead
              </button>
            </div>
          </div>
        )}

        {/* Manual Entry Dialog */}
        <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
          <DialogContent>
            <DialogHeader>
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100">
                <Keyboard className="h-7 w-7 text-brand-500" />
              </div>
              <DialogTitle className="text-center text-xl text-ink">Enter Ticket ID</DialogTitle>
              <p className="text-center text-sm text-gray-600">
                Type or paste the ID printed on the ticket
              </p>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                id="ticketId"
                placeholder="e.g. TKT-1A2B3C4D"
                value={manualTicketId}
                onChange={(e) => setManualTicketId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleManualVerify();
                  }
                }}
                className="h-13 rounded-2xl bg-brand-50 text-center font-mono text-base tracking-wide focus-visible:ring-brand-300"
              />
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleManualVerify}
                  disabled={loading || !manualTicketId.trim()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Looking up ticket...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Verify Ticket
                    </>
                  )}
                </button>
                <Button
                  variant="ghost"
                  onClick={() => setShowManualEntry(false)}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Ticket Details Modal */}
        <Dialog open={showTicketModal} onOpenChange={setShowTicketModal}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
            {ticketDetails && (
              <div>
                {/* Ticket header — dark stub */}
                <div className="rounded-t-3xl bg-brand-950 p-6">
                  <DialogHeader>
                    <DialogTitle className="sr-only">Ticket Details</DialogTitle>
                  </DialogHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-brand-300">
                        Event Ticket
                      </p>
                      <h4 className="mt-1 text-2xl font-bold text-white">
                        {ticketDetails.event.title}
                      </h4>
                      <p className="mt-1 text-sm text-brand-200">
                        {formatDate(ticketDetails.event.event_date)}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center rounded-full px-4 py-1.5 text-sm font-semibold ${
                      ticketDetails.is_used
                        ? "bg-red-50 text-[#b3261e]"
                        : "bg-[#EBFBF0] text-[#00B42A]"
                    }`}>
                      {ticketDetails.is_used ? (
                        <XCircle className="mr-1.5 h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      )}
                      {ticketDetails.is_used ? "Used" : "Valid"}
                    </span>
                  </div>

                  {/* Buyer chip */}
                  <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/30">
                      <User className="h-4 w-4 text-brand-200" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {ticketDetails.buyer.full_name}
                      </p>
                      <p className="truncate text-xs text-brand-200/70">
                        {ticketDetails.buyer.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="space-y-5 p-6">
                  {/* Info tiles */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-brand-50 p-4">
                      <p className="text-xs text-gray-600">Amount</p>
                      <p className="mt-0.5 text-lg font-bold text-brand-600">
                        {formatCurrency(ticketDetails.payment_amount)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-brand-50 p-4">
                      <p className="text-xs text-gray-600">Quantity</p>
                      <p className="mt-0.5 text-lg font-bold text-ink">
                        {ticketDetails.quantity}
                      </p>
                    </div>
                    {ticketDetails.ticket_tier && (
                      <>
                        <div className="rounded-2xl bg-brand-50 p-4">
                          <p className="text-xs text-gray-600">Category</p>
                          <span
                            className="mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-semibold"
                            style={{
                              backgroundColor: `${ticketDetails.ticket_tier.color || ticketDetails.ticket_tier.category?.color || '#5465FF'}20`,
                              color: ticketDetails.ticket_tier.color || ticketDetails.ticket_tier.category?.color || '#5465FF',
                            }}
                          >
                            {ticketDetails.ticket_tier.display_name || ticketDetails.ticket_tier.name}
                          </span>
                        </div>
                        <div className="rounded-2xl bg-brand-50 p-4">
                          <p className="text-xs text-gray-600">Tier</p>
                          <p className="mt-0.5 text-sm font-semibold text-ink">
                            {ticketDetails.ticket_tier.name}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* References */}
                  <div className="space-y-2 rounded-2xl border border-dashed border-brand-200 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-gray-600">Ticket ID</span>
                      <span className="truncate font-mono text-xs font-medium text-ink">
                        {ticketDetails.ticket_id}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-gray-600">Reference</span>
                      <span className="truncate font-mono text-xs font-medium text-ink">
                        {ticketDetails.purchase_reference}
                      </span>
                    </div>
                  </div>

                  {/* Usage Information */}
                  {ticketDetails.is_used && (
                    <div className="rounded-2xl bg-page-warm p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                        Usage
                      </p>
                      {ticketDetails.used_at && (
                        <p className="text-sm text-gray-600">
                          Used at <span className="font-medium text-ink">{formatDate(ticketDetails.used_at)}</span>
                        </p>
                      )}
                      {ticketDetails.verified_by && (
                        <p className="text-sm text-gray-600">
                          Verified by <span className="font-medium text-ink">{ticketDetails.verified_by.full_name}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {!ticketDetails.is_used && (
                      <button
                        onClick={verifyTicket}
                        disabled={verifying}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300 disabled:opacity-50"
                      >
                        {verifying ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Verify Ticket
                          </>
                        )}
                      </button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => {
                        resetScanner();
                        startScanning();
                      }}
                      className="flex-1 py-5"
                    >
                      <Scan className="mr-2 h-4 w-4" />
                      Scan Again
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowTicketModal(false);
                        resetScanner();
                      }}
                      className="flex-1 py-5"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}


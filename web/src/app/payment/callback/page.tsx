"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useCart } from "@/lib/cart/cart-context";
import { toast } from "sonner";

export default function PaymentCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Paystack: reference, trxref
    // Flutterwave: status, tx_ref, transaction_id
    const reference = searchParams.get("reference") || searchParams.get("trxref") || searchParams.get("tx_ref");
    const fwStatus = searchParams.get("status");

    if (!reference) {
      setStatus("failed");
      setMessage("No payment reference found in callback.");
      return;
    }

    // If provider reports failure in query, short-circuit
    if (fwStatus && fwStatus.toLowerCase() !== "successful") {
      setStatus("failed");
      setMessage("Payment reported as failed by provider.");
      return;
    }

    verifyPayment(reference);
  }, [searchParams]);

  const verifyPayment = async (reference: string) => {
    try {
      const response = await fetch(`/api/payments/verify/${reference}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Payment verification failed");
      }

      // Accept both shapes { payment: {... status }} and raw payment
      const payment = data.payment || data;
      if (payment?.status === "success" || payment?.status === "successful") {
        setStatus("success");
        setMessage("Payment successful! Your tickets are being generated...");
        clearCart();
        setTimeout(() => {
          router.push("/account/tickets");
        }, 2500);
      } else {
        setStatus("failed");
        setMessage("Payment verification did not return success.");
      }
    } catch (error: any) {
      setStatus("failed");
      setMessage(error.message || "Failed to verify payment");
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="mx-auto h-16 w-16 animate-spin text-primary" />
              <h2 className="mt-4 text-2xl font-semibold">Verifying Payment</h2>
              <p className="mt-2 text-foreground/70">
                Please wait while we verify your payment...
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
              <h2 className="mt-4 text-2xl font-semibold">Payment Successful!</h2>
              <p className="mt-2 text-foreground/70">{message}</p>
              <p className="mt-4 text-sm text-foreground/60">
                Redirecting to your tickets...
              </p>
            </>
          )}

          {status === "failed" && (
            <>
              <XCircle className="mx-auto h-16 w-16 text-destructive" />
              <h2 className="mt-4 text-2xl font-semibold">Payment Failed</h2>
              <p className="mt-2 text-foreground/70">{message}</p>
              <div className="mt-6 flex gap-3">
                <Button variant="outline" onClick={() => router.push("/cart")}>
                  Try Again
                </Button>
                <Button onClick={() => router.push("/tickets")}>
                  Browse Tickets
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



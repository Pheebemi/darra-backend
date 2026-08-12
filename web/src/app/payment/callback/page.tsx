"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { XCircle, Loader2 } from "lucide-react";
import { useCart } from "@/lib/cart/cart-context";

function CallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const reference =
      searchParams.get("reference") ||
      searchParams.get("trxref") ||
      searchParams.get("tx_ref");
    const fwStatus = searchParams.get("status");

    // If provider sends an explicit failure, stop early.
    if (
      fwStatus &&
      ["failed", "cancelled", "error"].includes(fwStatus.toLowerCase())
    ) {
      setStatus("failed");
      setMessage("Payment reported as failed by provider.");
      return;
    }

    // Proceed to verify when we have a reference; if missing, try tx_ref and still attempt verify.
    if (!reference) {
      setStatus("failed");
      setMessage("No payment reference found in callback.");
      return;
    }

    verifyPayment(reference);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const verifyPayment = async (reference: string) => {
    try {
      const response = await fetch(`/api/payments/verify/${reference}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Payment verification failed");
      }

      const payment = data.payment || data;
      if (
        payment?.status === "success" ||
        payment?.status === "successful" ||
        payment?.status === "completed"
      ) {
        setStatus("success");
        setMessage("Your order is confirmed and ready in your library.");
        clearCart();
        setTimeout(() => {
          router.push("/dashboard/buyer/library");
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

  if (status === "loading") {
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center bg-page px-6 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
        <h1 className="mt-6 text-xl font-semibold text-ink">Verifying payment</h1>
        <p className="mt-2 text-sm text-gray-500">Please wait while we confirm your payment...</p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center bg-page px-6 text-center">
        <XCircle className="h-14 w-14 text-destructive" />
        <h1 className="mt-6 text-2xl font-semibold text-ink">Payment failed</h1>
        <p className="mt-2 max-w-sm text-sm text-gray-500">{message}</p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/cart"
            className="rounded-full border border-brand-500 px-6 py-2.5 text-sm font-medium text-brand-500 transition-colors hover:bg-brand-50"
          >
            Try again
          </Link>
          <Link
            href="/products"
            className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center bg-page px-6 py-12 text-center">
      <img src="/illustrations/order-confirmed.svg" alt="" className="w-64 max-w-full sm:w-80" />
      <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-brand-500">Payment successful</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">Thank you for your purchase!</h1>
      <p className="mt-2 max-w-sm text-sm text-gray-500">{message}</p>
      <p className="mt-1 text-xs text-gray-400">Taking you to your library...</p>
      <Link
        href="/dashboard/buyer/library"
        className="mt-6 rounded-full bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
      >
        Go to my library
      </Link>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center bg-page px-6 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
          <h1 className="mt-6 text-xl font-semibold text-ink">Processing payment...</h1>
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}

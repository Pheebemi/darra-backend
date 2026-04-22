"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "sonner";
import { ArrowLeft, RotateCcw, ShoppingBag, CheckCircle } from "lucide-react";

function VerifyOTPInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "";
  const isLogin = searchParams.get("isLogin") === "true";
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { isLoading, fetchProfile } = useAuth();
  const otp = digits.join("");

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (otp.length !== 6) { toast.error("Please enter all 6 digits"); return; }
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, isLogin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Verification failed");
      if (isLogin) {
        await fetchProfile();
        toast.success("Welcome back!");
        router.push("/");
      } else {
        toast.success("Email verified! Please sign in.");
        setTimeout(() => router.push("/login"), 2000);
      }
    } catch (error: any) {
      toast.error(error.message || "Invalid code. Please try again.");
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("New code sent to your email");
      setCooldown(60);
    } catch (error: any) {
      toast.error(error.message || "Failed to resend code");
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (otp.length === 6 && !isLoading) handleVerify();
  }, [otp]);

  useEffect(() => {
    if (!email) router.push(isLogin ? "/login" : "/register");
  }, [email, isLogin, router]);

  const handleDigitChange = (i: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = digit;
    setDigits(next);
    if (digit && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[i]) { const n = [...digits]; n[i] = ""; setDigits(n); }
      else if (i > 0) inputRefs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) inputRefs.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  if (!email) return null;

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <ShoppingBag className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Darra</span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-primary/10 text-primary">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
            <h1 className="mb-1 text-xl font-semibold">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              {isLogin ? "Enter the code we sent to log you in" : "Enter the code to verify your account"}
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1">
              <span className="text-xs font-medium text-muted-foreground truncate max-w-[180px]">{email}</span>
            </div>
          </div>

          <form onSubmit={handleVerify}>
            {/* OTP boxes */}
            <div className="mb-2 flex justify-center gap-2" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  disabled={isLoading}
                  autoFocus={i === 0}
                  className={`h-12 w-11 rounded-lg border text-center text-lg font-semibold outline-none transition-all disabled:opacity-50 ${
                    digit
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-input bg-background text-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                  }`}
                />
              ))}
            </div>
            <p className="mb-5 text-center text-xs text-muted-foreground">
              6-digit code · expires in 10 minutes
            </p>

            <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Verifying...
                </span>
              ) : "Verify code"}
            </Button>

            <div className="mt-4 text-center">
              {cooldown > 0 ? (
                <p className="text-xs text-muted-foreground">Resend in <span className="font-medium text-foreground">{cooldown}s</span></p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLoading || isResending}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                >
                  <RotateCcw className={`h-3 w-3 ${isResending ? "animate-spin" : ""}`} />
                  {isResending ? "Sending..." : "Didn't get it? Resend"}
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="mt-5 text-center">
          <Link
            href={isLogin ? "/login" : "/register"}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {isLogin ? "sign in" : "register"}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOTPPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-background">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-primary/10 text-primary animate-pulse">
          <CheckCircle className="h-6 w-6" />
        </div>
      </div>
    }>
      <VerifyOTPInner />
    </Suspense>
  );
}

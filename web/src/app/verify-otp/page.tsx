"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "sonner";
import { ArrowLeft, RotateCcw, MailCheck } from "lucide-react";

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
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-page px-5 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500">
              <span className="text-lg font-bold text-white">D</span>
            </div>
            <span className="text-lg font-semibold text-ink">Darra</span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mb-5 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-500">
                <MailCheck className="h-7 w-7" />
              </div>
            </div>
            <h1 className="mb-1 text-2xl font-semibold text-ink">Check your email</h1>
            <p className="text-sm text-gray-600">
              {isLogin ? "Enter the code we sent to log you in" : "Enter the code to verify your account"}
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-4 py-1.5">
              <span className="max-w-[180px] truncate text-xs font-medium text-brand-700">{email}</span>
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
                  className={`h-13 w-11 rounded-xl border text-center text-lg font-semibold outline-none transition-all disabled:opacity-50 ${
                    digit
                      ? "border-brand-500 bg-brand-50 text-brand-600"
                      : "border-gray-200 bg-white text-ink focus:border-brand-300 focus:ring focus:ring-brand-300"
                  }`}
                />
              ))}
            </div>
            <p className="mb-6 text-center text-xs text-gray-500">
              6-digit code · expires in 10 minutes
            </p>

            <button
              type="submit"
              className="w-full rounded-full bg-brand-500 px-6 py-3.5 font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300 active:bg-brand-700 disabled:opacity-60"
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Verifying...
                </span>
              ) : "Verify code"}
            </button>

            <div className="mt-4 text-center">
              {cooldown > 0 ? (
                <p className="text-xs text-gray-500">Resend in <span className="font-medium text-ink">{cooldown}s</span></p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLoading || isResending}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-500 transition-colors hover:text-brand-600 disabled:opacity-50"
                >
                  <RotateCcw className={`h-3 w-3 ${isResending ? "animate-spin" : ""}`} />
                  {isResending ? "Sending..." : "Didn't get it? Resend"}
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link
            href={isLogin ? "/login" : "/register"}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 transition-colors hover:text-brand-500"
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
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-page">
        <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-brand-100 text-brand-500">
          <MailCheck className="h-7 w-7" />
        </div>
      </div>
    }>
      <VerifyOTPInner />
    </Suspense>
  );
}

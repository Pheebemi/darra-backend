"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "sonner";
import { Mail, Shield, RotateCcw, ArrowLeft, CheckCircle } from "lucide-react";

export default function VerifyOTPPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "";
  const isLogin = searchParams.get("isLogin") === "true";
  const [otp, setOtp] = useState("");
  const [isResending, setIsResending] = useState(false);
  const { loginWithOTP, isLoading, fetchProfile } = useAuth();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otp) {
      toast.error("Please enter the verification code");
      return;
    }

    if (otp.length !== 6) {
      toast.error("Code must be 6 digits");
      return;
    }

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, isLogin }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Verification failed");
      }

      if (isLogin) {
        // Login flow - fetch profile to update auth state
        await fetchProfile();
        toast.success("Welcome back! Login successful.");
        router.push("/");
      } else {
        // Registration flow - redirect to login
        toast.success("Your email has been verified successfully! Please login to continue.");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (error: any) {
      toast.error(error.message || "Invalid code. Please try again.");
      setOtp("");
    }
  };

  const handleResendOTP = async () => {
    setIsResending(true);
    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send code");
      }

      toast.success("A new verification code has been sent to your email");
    } catch (error: any) {
      toast.error(error.message || "Failed to send code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  // Auto-submit when OTP is complete
  useEffect(() => {
    if (otp.length === 6 && !isLoading) {
      handleVerify(new Event('submit') as any);
    }
  }, [otp]);

  // Redirect if no email
  useEffect(() => {
    if (!email) {
      router.push(isLogin ? "/login" : "/register");
    }
  }, [email, isLogin, router]);

  if (!email) {
    return null;
  }

  return (
    <div className="min-h-[calc(100dvh-8rem)] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-900">
      <div className="absolute inset-0 bg-grid-slate-900/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-400/10 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />
      
      <div className="relative flex min-h-[calc(100dvh-8rem)] items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Card Container */}
          <div className="rounded-2xl border border-slate-200/50 bg-white/80 p-8 shadow-2xl backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/80">
            {/* Header */}
            <div className="mb-8 text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white">
                  <Shield className="h-6 w-6" />
                </div>
              </div>
              <h1 className="mb-3 text-3xl font-bold bg-gradient-to-br from-slate-900 to-blue-700 dark:from-slate-100 dark:to-blue-400 bg-clip-text text-transparent">
                Verify Email
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-300 mb-2">
                {isLogin
                  ? "Enter the code sent to your email to login"
                  : "Enter the code to verify your account"}
              </p>
              
              {/* Email Display */}
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                <Mail className="h-4 w-4" />
                {email}
              </div>
            </div>

            {/* OTP Form */}
            <form onSubmit={handleVerify} className="space-y-6">
              {/* OTP Input */}
              <div className="space-y-3">
                <Label htmlFor="otp" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Verification Code
                </Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    setOtp(value);
                  }}
                  disabled={isLoading}
                  className="text-center text-3xl tracking-[0.5em] font-mono h-16 rounded-xl border-slate-300 bg-white transition-colors focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white"
                  autoFocus
                />
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                  Enter the 6-digit code sent to your email
                </p>
              </div>

              {/* Resend Code */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={isLoading || isResending}
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  <RotateCcw className={`h-4 w-4 ${isResending ? 'animate-spin' : ''}`} />
                  {isResending ? "Sending..." : "Didn't receive the code? Resend"}
                </button>
              </div>

              {/* Verify Button */}
              <Button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 py-3 text-base font-medium text-white shadow-lg transition-all hover:from-blue-700 hover:to-purple-700 hover:shadow-xl disabled:opacity-50"
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Verifying...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Verify Code
                  </div>
                )}
              </Button>
            </form>

            {/* Back Link */}
            <div className="mt-8 text-center">
              <Link 
                href={isLogin ? "/login" : "/register"} 
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to {isLogin ? "login" : "register"}
              </Link>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-8 grid grid-cols-3 gap-4 text-center text-xs text-slate-500 dark:text-slate-500">
            <div className="flex flex-col items-center">
              <Shield className="h-4 w-4 mb-1" />
              <span>Secure</span>
            </div>
            <div className="flex flex-col items-center">
              <Mail className="h-4 w-4 mb-1" />
              <span>Email</span>
            </div>
            <div className="flex flex-col items-center">
              <CheckCircle className="h-4 w-4 mb-1" />
              <span>Verified</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
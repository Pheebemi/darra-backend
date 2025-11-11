"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "sonner";

export default function VerifyOTPPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "";
  const isLogin = searchParams.get("isLogin") === "true";
  const [otp, setOtp] = useState("");
  const { loginWithOTP, isLoading, fetchProfile } = useAuth();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otp) {
      toast.error("Please enter the OTP code");
      return;
    }

    if (otp.length !== 6) {
      toast.error("OTP must be 6 digits");
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
        throw new Error(data.message || "OTP verification failed");
      }

      if (isLogin) {
        // Login flow - fetch profile to update auth state
        await fetchProfile();
        toast.success("Login successful!");
        router.push("/");
      } else {
        // Registration flow - redirect to login
        toast.success("Your email has been verified successfully! Please login to continue.");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    } catch (error: any) {
      toast.error(error.message || "Invalid OTP. Please try again.");
      setOtp("");
    }
  };

  const handleResendOTP = async () => {
    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send OTP");
      }

      toast.success("A new OTP has been sent to your email");
    } catch (error: any) {
      toast.error(error.message || "Failed to send OTP. Please try again.");
    }
  };

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
    <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="mb-3 text-2xl font-bold text-foreground">Verify OTP</h1>
          <p className="text-base text-foreground/70">
            {isLogin
              ? "Enter the OTP sent to your email to login."
              : "Enter the OTP sent to your email to verify your account."}
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="otp">OTP Code</Label>
            <Input
              id="otp"
              type="text"
              placeholder="Enter OTP code"
              maxLength={6}
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setOtp(value);
              }}
              disabled={isLoading}
              className="text-center text-2xl tracking-[0.5em] font-mono"
            />
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={isLoading}
              className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
            >
              Didn&apos;t receive the code? Resend
            </button>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Verifying..." : "Verify OTP"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-foreground/70">
          <Link href={isLogin ? "/login" : "/register"} className="text-primary hover:underline">
            Back to {isLogin ? "login" : "register"}
          </Link>
        </div>
      </div>
    </div>
  );
}




"use client";
import { useState } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, User, Building, Ticket, UserCheck } from "lucide-react";

type UserType = "BUYER" | "SELLER";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userType, setUserType] = useState<UserType>("BUYER");
  const [brandName, setBrandName] = useState("");
  const [brandSlug, setBrandSlug] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register, isLoading } = useAuth();

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
                  <UserCheck className="h-6 w-6" />
                </div>
              </div>
              <h1 className="mb-3 text-3xl font-bold bg-gradient-to-br from-slate-900 to-blue-700 dark:from-slate-100 dark:to-blue-400 bg-clip-text text-transparent">
                Join Darra
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-300">
                Start your journey with us today
              </p>
            </div>

            {/* Form */}
            <form
              className="space-y-6"
              onSubmit={async (e) => {
                e.preventDefault();
                
                if (!email || !password || !confirmPassword || !fullName) {
                  toast.error("Please fill in all required fields");
                  return;
                }

                if (password !== confirmPassword) {
                  toast.error("Passwords do not match");
                  return;
                }

                if (userType === "SELLER" && !brandName) {
                  toast.error("Please enter your brand name");
                  return;
                }

                try {
                  await register({
                    email,
                    password,
                    full_name: fullName,
                    user_type: userType,
                    brand_name: userType === "SELLER" ? brandName : undefined,
                    brand_slug: userType === "SELLER" && brandSlug ? brandSlug : undefined,
                  });
                } catch (error) {
                  // Error is handled by auth context
                }
              }}
            >
              {/* Full Name Field */}
              <div className="space-y-3">
                <Label htmlFor="fullName" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Full Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                    className="rounded-xl border-slate-300 bg-white pl-10 pr-4 py-3 transition-colors focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white"
                  />
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-3">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="rounded-xl border-slate-300 bg-white pl-10 pr-4 py-3 transition-colors focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-3">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="rounded-xl border-slate-300 bg-white pl-10 pr-12 py-3 transition-colors focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transform text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-3">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    className="rounded-xl border-slate-300 bg-white pl-10 pr-12 py-3 transition-colors focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transform text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* User Type Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  I want to:
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setUserType("BUYER")}
                    disabled={isLoading}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all ${
                      userType === "BUYER"
                        ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:border-slate-500"
                    }`}
                  >
                    <Ticket className="h-4 w-4" />
                    Buy Tickets
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserType("SELLER")}
                    disabled={isLoading}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all ${
                      userType === "SELLER"
                        ? "border-purple-500 bg-purple-50 text-purple-700 shadow-sm dark:border-purple-400 dark:bg-purple-900/20 dark:text-purple-300"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:border-slate-500"
                    }`}
                  >
                    <Building className="h-4 w-4" />
                    Sell Tickets
                  </button>
                </div>
              </div>

              {/* Seller-specific Fields */}
              {userType === "SELLER" && (
                <div className="space-y-4 rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                  <div className="space-y-3">
                    <Label htmlFor="brandName" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Brand Name *
                    </Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-slate-400" />
                      <Input
                        id="brandName"
                        type="text"
                        placeholder="Enter your brand name"
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        disabled={isLoading}
                        className="rounded-xl border-slate-300 bg-white pl-10 pr-4 py-3 transition-colors focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="brandSlug" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Brand URL (optional)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 transform text-slate-400 text-sm">
                        darra.com/
                      </span>
                      <Input
                        id="brandSlug"
                        type="text"
                        placeholder="your-brand"
                        value={brandSlug}
                        onChange={(e) => setBrandSlug(e.target.value)}
                        disabled={isLoading}
                        className="rounded-xl border-slate-300 bg-white pl-24 pr-4 py-3 transition-colors focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 py-3 text-base font-medium text-white shadow-lg transition-all hover:from-blue-700 hover:to-purple-700 hover:shadow-xl disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating account...
                  </div>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            {/* Sign In Link */}
            <div className="mt-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">
                Already have an account?{" "}
                <Link 
                  href="/login" 
                  className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-8 grid grid-cols-3 gap-4 text-center text-xs text-slate-500 dark:text-slate-500">
            <div className="flex flex-col items-center">
              <Shield className="h-4 w-4 mb-1" />
              <span>Secure</span>
            </div>
            <div className="flex flex-col items-center">
              <Zap className="h-4 w-4 mb-1" />
              <span>Instant</span>
            </div>
            <div className="flex flex-col items-center">
              <Ticket className="h-4 w-4 mb-1" />
              <span>Verified</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Trust Icons Component
function Shield({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function Zap({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}
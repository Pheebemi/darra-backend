"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ShoppingBag, Store, CheckCircle2, XCircle, Loader2 } from "lucide-react";

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
  const [showConfirm, setShowConfirm] = useState(false);
  const [brandAvailable, setBrandAvailable] = useState<boolean | null>(null);
  const [checkingBrand, setCheckingBrand] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { register, isLoading } = useAuth();

  useEffect(() => {
    if (!brandName || brandName.length < 2) { setBrandAvailable(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCheckingBrand(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-brand-name?brand_name=${encodeURIComponent(brandName)}`);
        const data = await res.json();
        setBrandAvailable(data.available);
      } catch {
        setBrandAvailable(null);
      } finally {
        setCheckingBrand(false);
      }
    }, 500);
  }, [brandName]);

  return (
    <div className="flex min-h-[calc(100dvh-4rem)]">

      {/* Left — brand */}
      <div className="hidden flex-col justify-between bg-brand-950 p-12 lg:flex lg:w-1/2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500">
            <span className="text-lg font-bold text-white">D</span>
          </div>
          <span className="text-lg font-semibold text-white">Darra</span>
        </div>

        <div>
          <h2 className="mb-3 text-4xl font-bold leading-tight text-white">
            Join thousands of creators and learners
          </h2>
          <p className="text-lg text-brand-200">
            Create an account to start buying or selling digital products today.
          </p>
          <div className="mt-10 space-y-3">
            {[
              "Sell your eBooks, templates, and courses",
              "Instant payouts to your bank account",
              "Secure checkout for buyers",
              "QR-code access verification",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs text-white">✓</span>
                <span className="text-sm text-brand-100">{item}</span>
              </div>
            ))}
          </div>
          <img
            src="/illustrations/payments.svg"
            alt="Secure payments illustration"
            className="mx-auto mt-10 w-full max-w-xs"
          />
        </div>

        <p className="text-xs text-brand-300/60">© {new Date().getFullYear()} Darra</p>
      </div>

      {/* Right — form */}
      <div className="flex w-full flex-col items-center justify-center overflow-y-auto bg-page px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500">
              <span className="text-lg font-bold text-white">D</span>
            </div>
            <span className="text-lg font-semibold text-ink">Darra</span>
          </div>

          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand-500">Sign up</p>
          <h1 className="mb-1 text-3xl font-semibold text-ink">Create an account</h1>
          <p className="mb-8 text-gray-600">Get started on Darra for free</p>

          {/* Role selector */}
          <div className="mb-6 flex overflow-hidden rounded-full border border-gray-200 bg-white p-1">
            {(["BUYER", "SELLER"] as UserType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setUserType(type)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium transition-colors ${
                  userType === type
                    ? "bg-brand-500 text-white"
                    : "text-gray-600 hover:text-brand-500"
                }`}
              >
                {type === "BUYER" ? <ShoppingBag className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                {type === "BUYER" ? "Buyer" : "Seller"}
              </button>
            ))}
          </div>

          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!email || !password || !confirmPassword || !fullName) {
                toast.error("Please fill in all required fields"); return;
              }
              if (password !== confirmPassword) {
                toast.error("Passwords do not match"); return;
              }
              if (userType === "SELLER" && !brandName) {
                toast.error("Please enter your brand name"); return;
              }
              if (userType === "SELLER" && brandAvailable === false) {
                toast.error("That brand name is already taken"); return;
              }
              if (userType === "SELLER" && checkingBrand) {
                toast.error("Please wait while we check your brand name"); return;
              }
              try {
                await register({
                  email, password, full_name: fullName, user_type: userType,
                  brand_name: userType === "SELLER" ? brandName : undefined,
                  brand_slug: userType === "SELLER" && brandSlug ? brandSlug : undefined,
                });
              } catch (_) {}
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-sm font-medium text-gray-900">Full name</Label>
              <Input id="fullName" placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={isLoading}
                className="h-12 rounded-xl border-gray-200 bg-white px-4 focus-visible:ring-brand-300" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-900">Email address</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading}
                className="h-12 rounded-xl border-gray-200 bg-white px-4 focus-visible:ring-brand-300" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-900">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading}
                  className="h-12 rounded-xl border-gray-200 bg-white px-4 pr-11 focus-visible:ring-brand-300" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ink">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-sm font-medium text-gray-900">Confirm password</Label>
              <div className="relative">
                <Input id="confirm" type={showConfirm ? "text" : "password"} placeholder="Repeat your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading}
                  className="h-12 rounded-xl border-gray-200 bg-white px-4 pr-11 focus-visible:ring-brand-300" />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ink">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Seller fields */}
            {userType === "SELLER" && (
              <div className="space-y-4 rounded-2xl bg-brand-50 p-4">
                <p className="text-sm font-medium text-brand-700">Seller information</p>
                <div className="space-y-1.5">
                  <Label htmlFor="brandName" className="text-sm font-medium text-gray-900">Brand name *</Label>
                  <div className="relative">
                    <Input
                      id="brandName"
                      placeholder="Your brand or store name"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      disabled={isLoading}
                      className={`h-12 rounded-xl border-gray-200 bg-white px-4 pr-11 focus-visible:ring-brand-300 ${brandAvailable === false ? "border-[#b3261e] focus-visible:ring-[#b3261e]" : brandAvailable === true ? "border-[#00B42A] focus-visible:ring-[#00B42A]" : ""}`}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {checkingBrand && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                      {!checkingBrand && brandAvailable === true && <CheckCircle2 className="h-4 w-4 text-[#00B42A]" />}
                      {!checkingBrand && brandAvailable === false && <XCircle className="h-4 w-4 text-[#b3261e]" />}
                    </div>
                  </div>
                  {!checkingBrand && brandAvailable === true && (
                    <p className="text-xs text-[#00B42A]">Brand name is available</p>
                  )}
                  {!checkingBrand && brandAvailable === false && (
                    <p className="text-xs text-[#b3261e]">Brand name is already taken</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="brandSlug" className="text-sm font-medium text-gray-900">
                    Brand URL <span className="font-normal text-gray-500">(optional)</span>
                  </Label>
                  <div className="flex items-center rounded-xl border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-brand-300">
                    <span className="border-r border-gray-200 px-3 py-3 text-xs text-gray-500">darra.com/</span>
                    <input
                      id="brandSlug"
                      placeholder="your-brand"
                      value={brandSlug}
                      onChange={(e) => setBrandSlug(e.target.value)}
                      disabled={isLoading}
                      className="h-12 flex-1 bg-transparent px-3 text-sm outline-none disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-full bg-brand-500 px-6 py-3.5 font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300 active:bg-brand-700 disabled:opacity-60"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating account...
                </span>
              ) : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-500 transition-colors hover:text-brand-600">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

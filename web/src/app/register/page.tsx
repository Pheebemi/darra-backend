"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ShoppingBag, Store } from "lucide-react";

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
  const { register, isLoading } = useAuth();

  return (
    <div className="flex min-h-[calc(100dvh-4rem)]">

      {/* Left — brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <span className="font-semibold">Darra</span>
        </div>

        <div>
          <h2 className="mb-3 text-4xl font-semibold leading-tight">
            Join thousands of creators and learners
          </h2>
          <p className="text-primary-foreground/70">
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
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs">✓</span>
                <span className="text-sm text-primary-foreground/80">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-primary-foreground/40">© {new Date().getFullYear()} Darra</p>
      </div>

      {/* Right — form */}
      <div className="flex w-full flex-col items-center justify-center overflow-y-auto bg-background px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <ShoppingBag className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Darra</span>
          </div>

          <h1 className="mb-1 text-2xl font-semibold">Create an account</h1>
          <p className="mb-7 text-sm text-muted-foreground">Get started on Darra for free</p>

          {/* Role selector */}
          <div className="mb-5 flex overflow-hidden rounded-lg border">
            {(["BUYER", "SELLER"] as UserType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setUserType(type)}
                className={`flex flex-1 items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                  userType === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {type === "BUYER" ? <ShoppingBag className="h-3.5 w-3.5" /> : <Store className="h-3.5 w-3.5" />}
                {type === "BUYER" ? "Buyer" : "Seller"}
              </button>
            ))}
          </div>

          <form
            className="space-y-4"
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
              <Label htmlFor="fullName" className="text-xs font-medium">Full name</Label>
              <Input id="fullName" placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={isLoading} className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} className="h-9 pr-9" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-xs font-medium">Confirm password</Label>
              <div className="relative">
                <Input id="confirm" type={showConfirm ? "text" : "password"} placeholder="Repeat your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} className="h-9 pr-9" />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Seller fields */}
            {userType === "SELLER" && (
              <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">Seller information</p>
                <div className="space-y-1.5">
                  <Label htmlFor="brandName" className="text-xs font-medium">Brand name *</Label>
                  <Input id="brandName" placeholder="Your brand or store name" value={brandName} onChange={(e) => setBrandName(e.target.value)} disabled={isLoading} className="h-9 bg-background" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="brandSlug" className="text-xs font-medium">
                    Brand URL <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <div className="flex items-center rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring/50">
                    <span className="border-r px-2.5 py-2 text-xs text-muted-foreground">darra.com/</span>
                    <input
                      id="brandSlug"
                      placeholder="your-brand"
                      value={brandSlug}
                      onChange={(e) => setBrandSlug(e.target.value)}
                      disabled={isLoading}
                      className="h-9 flex-1 bg-transparent px-2.5 text-sm outline-none disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Creating account...
                </span>
              ) : "Create account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground hover:text-primary transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

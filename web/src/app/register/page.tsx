"use client";
import { useState } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "sonner";

type UserType = "BUYER" | "SELLER";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userType, setUserType] = useState<UserType>("BUYER");
  const [brandName, setBrandName] = useState("");
  const [brandSlug, setBrandSlug] = useState("");
  const { register, isLoading } = useAuth();

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="mb-3 text-2xl font-bold text-foreground">Create Account</h1>
          <p className="text-base text-foreground/70">
            Join Darra to start your journey.
          </p>
        </div>

        <form
          className="space-y-5"
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
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>I want to:</Label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setUserType("BUYER")}
                disabled={isLoading}
                className={`flex-1 rounded-xl border px-4 py-4 text-center text-sm font-medium transition-colors ${
                  userType === "BUYER"
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-card text-foreground hover:bg-card/80"
                }`}
              >
                Buy Products
              </button>
              <button
                type="button"
                onClick={() => setUserType("SELLER")}
                disabled={isLoading}
                className={`flex-1 rounded-xl border px-4 py-4 text-center text-sm font-medium transition-colors ${
                  userType === "SELLER"
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-card text-foreground hover:bg-card/80"
                }`}
              >
                Sell Products
              </button>
            </div>
          </div>

          {userType === "SELLER" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="brandName">Brand Name</Label>
                <Input
                  id="brandName"
                  type="text"
                  placeholder="Enter your brand name"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brandSlug">Brand URL (optional)</Label>
                <Input
                  id="brandSlug"
                  type="text"
                  placeholder="your-brand-url"
                  value={brandSlug}
                  onChange={(e) => setBrandSlug(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Please wait..." : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-1 text-sm">
          <span className="text-foreground/70">Already have an account? </span>
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}



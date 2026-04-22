"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ShoppingBag } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuth();

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
            The marketplace for creators and learners
          </h2>
          <p className="text-primary-foreground/70">
            Buy and sell eBooks, templates, courses, and more.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-3">
            {[
              { label: "Products listed", value: "10,000+" },
              { label: "Happy buyers", value: "50,000+" },
              { label: "Active sellers", value: "2,000+" },
              { label: "Avg. rating", value: "4.9 ★" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-white/10 p-4">
                <p className="text-xl font-semibold">{s.value}</p>
                <p className="text-sm text-primary-foreground/60">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-primary-foreground/40">© {new Date().getFullYear()} Darra</p>
      </div>

      {/* Right — form */}
      <div className="flex w-full flex-col items-center justify-center bg-background px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <ShoppingBag className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Darra</span>
          </div>

          <h1 className="mb-1 text-2xl font-semibold">Welcome back</h1>
          <p className="mb-7 text-sm text-muted-foreground">Sign in to your Darra account</p>

          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try { await login(email, password); } catch (_) {}
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-9 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Signing in...
                </span>
              ) : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-foreground hover:text-primary transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

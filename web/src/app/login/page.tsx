"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuth();

  return (
    <div className="flex min-h-[calc(100dvh-4rem)]">

      {/* Left — brand */}
      <div className="hidden flex-col justify-between bg-brand-950 p-12 lg:flex lg:w-1/2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">
            <img src="/logo.svg" alt="Darra" className="h-8 w-auto" />
          </div>
          <span className="text-lg font-semibold text-white">Darra</span>
        </div>

        <div>
          <h2 className="mb-3 text-4xl font-bold leading-tight text-white">
            The marketplace for creators and learners
          </h2>
          <p className="text-lg text-brand-200">
            Buy and sell eBooks, templates, courses, and more.
          </p>
          <img
            src="/illustrations/online-shopping.svg"
            alt="Online shopping illustration"
            className="mx-auto mt-10 w-full max-w-sm"
          />
        </div>

        <p className="text-xs text-brand-300/60">© {new Date().getFullYear()} Darra</p>
      </div>

      {/* Right — form */}
      <div className="flex w-full flex-col items-center justify-center bg-page px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white ring-1 ring-line-strong">
              <img src="/logo.svg" alt="Darra" className="h-8 w-auto" />
            </div>
            <span className="text-lg font-semibold text-ink">Darra</span>
          </div>

          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-accent-link">Sign in</p>
          <h1 className="mb-1 text-3xl font-semibold text-ink">Welcome back</h1>
          <p className="mb-8 text-body">Sign in to your Darra account</p>

          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              try { await login(email, password); } catch (_) {}
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-strong">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="h-12 rounded-xl border-line-strong bg-surface px-4 focus-visible:ring-brand-300"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-strong">Password</Label>
                <Link href="/forgot-password" className="text-sm font-medium text-accent-link transition-colors hover:text-accent-link">
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
                  className="h-12 rounded-xl border-line-strong bg-surface px-4 pr-11 focus-visible:ring-brand-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-brand-500 px-6 py-3.5 font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300 active:bg-brand-700 disabled:opacity-60"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in...
                </span>
              ) : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-body">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-accent-link transition-colors hover:text-accent-link">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

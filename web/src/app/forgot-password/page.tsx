"use client";
import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MailCheck } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email address");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Something went wrong");
      // The API deliberately answers the same way whether or not the account
      // exists, so the UI must not imply the address was found.
      setSent(true);
    } catch (err: any) {
      toast.error(err.message || "Could not send the reset email");
    } finally {
      setLoading(false);
    }
  };

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
            Happens to everyone
          </h2>
          <p className="text-lg text-brand-200">
            Enter your email and we'll send you a link to get back in.
          </p>
          <img
            src="/illustrations/web-search.svg"
            alt=""
            className="mx-auto mt-10 w-full max-w-sm"
          />
        </div>

        <p className="text-xs text-brand-300/60">© {new Date().getFullYear()} Darra</p>
      </div>

      {/* Right — form */}
      <div className="flex w-full flex-col items-center justify-center bg-page px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500">
              <span className="text-lg font-bold text-white">D</span>
            </div>
            <span className="text-lg font-semibold text-ink">Darra</span>
          </div>

          {sent ? (
            <div>
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100">
                <MailCheck className="h-7 w-7 text-brand-500" />
              </div>
              <h1 className="mb-2 text-3xl font-semibold text-ink">Check your email</h1>
              <p className="mb-2 text-gray-600">
                If an account exists for <span className="font-medium text-ink">{email}</span>,
                a reset link is on its way.
              </p>
              <p className="mb-8 text-sm text-gray-500">
                It can take a minute to arrive. Check your spam folder too.
              </p>

              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="mb-4 w-full rounded-full border border-brand-500 px-6 py-3 font-medium text-brand-500 transition-colors hover:bg-brand-500 hover:text-white"
              >
                Use a different email
              </button>

              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-brand-500"
              >
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand-500">
                Password
              </p>
              <h1 className="mb-1 text-3xl font-semibold text-ink">Forgot your password?</h1>
              <p className="mb-8 text-gray-600">
                Enter the email you signed up with and we'll send a reset link.
              </p>

              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <Label htmlFor="email" className="mb-1.5 block text-sm">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="h-11"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-brand-500 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300 disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>

              <p className="mt-8 text-sm text-gray-600">
                Remembered it?{" "}
                <Link href="/login" className="font-medium text-brand-500 hover:text-brand-600">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

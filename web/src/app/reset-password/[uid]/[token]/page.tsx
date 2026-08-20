"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const params = useParams();
  const router = useRouter();
  const uid = params?.uid as string;
  const token = params?.token as string;

  const [checking, setChecking] = useState(true);
  const [linkValid, setLinkValid] = useState(false);
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Check the link before showing the form, so an expired link says so up
  // front instead of after the user has typed a new password twice.
  useEffect(() => {
    if (!uid || !token) return;
    (async () => {
      try {
        const res = await fetch(`/api/auth/password-reset/${uid}/${token}`);
        const data = await res.json();
        setLinkValid(res.ok && data.valid);
        setEmail(data.email || "");
      } catch {
        setLinkValid(false);
      } finally {
        setChecking(false);
      }
    })();
  }, [uid, token]);

  const rules = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "Not entirely numbers", ok: !/^\d+$/.test(password) && password.length > 0 },
    { label: "Both passwords match", ok: password.length > 0 && password === confirm },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/auth/password-reset/${uid}/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not reset your password");

      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err: any) {
      toast.error(err.message || "Could not reset your password");
    } finally {
      setSaving(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="flex min-h-[calc(100dvh-4rem)]">
      <div className="hidden flex-col justify-between bg-brand-950 p-12 lg:flex lg:w-1/2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white">
            <img src="/logo.svg" alt="Darra" className="h-8 w-auto" />
          </div>
          <span className="text-lg font-semibold text-white">Darra</span>
        </div>
        <div>
          <h2 className="mb-3 text-4xl font-bold leading-tight text-white">
            Choose a new password
          </h2>
          <p className="text-lg text-brand-200">
            Pick something you haven't used elsewhere.
          </p>
          <img src="/illustrations/payments.svg" alt="" className="mx-auto mt-10 w-full max-w-sm" />
        </div>
        <p className="text-xs text-brand-300/60">© {new Date().getFullYear()} Darra</p>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-page px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white ring-1 ring-line-strong">
              <img src="/logo.svg" alt="Darra" className="h-8 w-auto" />
            </div>
            <span className="text-lg font-semibold text-ink">Darra</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );

  if (checking) {
    return (
      <Shell>
        <div className="flex items-center gap-3 text-body">
          <Loader2 className="h-5 w-5 animate-spin text-accent-link" />
          Checking your link...
        </div>
      </Shell>
    );
  }

  if (!linkValid) {
    return (
      <Shell>
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-err-soft">
          <XCircle className="h-7 w-7 text-err" />
        </div>
        <h1 className="mb-2 text-3xl font-semibold text-ink">Link expired</h1>
        <p className="mb-8 text-body">
          This reset link is no longer valid. Links can only be used once and
          expire after a few hours — request a fresh one.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block w-full rounded-full bg-brand-500 px-6 py-3 text-center font-medium text-white transition-colors hover:bg-brand-600"
        >
          Request a new link
        </Link>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-ok-soft">
          <CheckCircle2 className="h-7 w-7 text-ok" />
        </div>
        <h1 className="mb-2 text-3xl font-semibold text-ink">Password updated</h1>
        <p className="mb-8 text-body">
          You can now sign in with your new password. Taking you there...
        </p>
        <Link
          href="/login"
          className="inline-block w-full rounded-full bg-brand-500 px-6 py-3 text-center font-medium text-white transition-colors hover:bg-brand-600"
        >
          Sign in
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-accent-link">
        Password
      </p>
      <h1 className="mb-1 text-3xl font-semibold text-ink">Set a new password</h1>
      <p className="mb-8 text-body">
        {email ? <>For <span className="font-medium text-ink">{email}</span></> : "Choose something secure."}
      </p>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="password" className="mb-1.5 block text-sm">New password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="h-11 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-body"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <Label htmlFor="confirm" className="mb-1.5 block text-sm">Confirm password</Label>
          <Input
            id="confirm"
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your new password"
            autoComplete="new-password"
            className="h-11"
          />
        </div>

        {password.length > 0 && (
          <ul className="space-y-1.5">
            {rules.map((r) => (
              <li key={r.label} className="flex items-center gap-2 text-xs">
                <CheckCircle2
                  className={`h-3.5 w-3.5 ${r.ok ? "text-ok" : "text-faint"}`}
                />
                <span className={r.ok ? "text-body" : "text-faint"}>{r.label}</span>
              </li>
            ))}
          </ul>
        )}

        <button
          type="submit"
          disabled={saving || !rules.every((r) => r.ok)}
          className="w-full rounded-full bg-brand-500 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300 disabled:opacity-50"
        >
          {saving ? "Updating..." : "Update password"}
        </button>
      </form>

      <p className="mt-8 text-sm text-body">
        <Link href="/login" className="font-medium text-accent-link hover:text-accent-link">
          Back to sign in
        </Link>
      </p>
    </Shell>
  );
}

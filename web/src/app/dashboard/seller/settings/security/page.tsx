"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function SellerSecurityPage() {
  const { isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (initialized && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, initialized, router]);

  const handleSave = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all fields"); return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match"); return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters"); return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed");
      }
      toast.success("Password updated successfully.");
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (e: any) {
      toast.error(e.message || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  if (!initialized || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center"><p>Loading...</p></div>;
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl p-6 sm:p-8">
        <div className="mb-8">
          <Link
            href="/dashboard/seller/settings"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-body transition-colors hover:text-accent-link"
          >
            <ArrowLeft className="h-4 w-4" /> Settings
          </Link>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent-link">Security</p>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Change Password</h1>
          <p className="mt-1 text-sm text-body">Update your account password</p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <Label htmlFor="old_password" className="mb-1.5 block text-sm">Current Password</Label>
              <div className="relative">
                <Input
                  id="old_password"
                  type={showOld ? "text" : "password"}
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  className="rounded-xl pr-10"
                  placeholder="Enter current password"
                />
                <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="new_password" className="mb-1.5 block text-sm">New Password</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="rounded-xl pr-10"
                  placeholder="At least 8 characters"
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirm_password" className="mb-1.5 block text-sm">Confirm New Password</Label>
              <Input
                id="confirm_password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="rounded-xl"
                placeholder="Repeat new password"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-brand-500 text-white hover:bg-brand-600"
            >
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Update Password</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

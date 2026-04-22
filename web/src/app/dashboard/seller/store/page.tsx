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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Store,
  Clock,
  ExternalLink,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  PackageOpen,
} from "lucide-react";
import { toast } from "sonner";

interface StoreProfile {
  brand_name: string;
  brand_slug: string;
  about: string;
  open_time: string;
  close_time: string;
  store_active: boolean;
}

export default function SellerStorePage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  // editable fields
  const [about, setAbout] = useState("");
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("18:00");

  useEffect(() => {
    if (initialized && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, initialized, router]);

  useEffect(() => {
    if (isAuthenticated) fetchStore();
  }, [isAuthenticated]);

  const fetchStore = async () => {
    try {
      const res = await fetch("/api/seller/store");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setProfile(data);
      setAbout(data.about || "");
      setOpenTime(data.open_time || "09:00");
      setCloseTime(data.close_time || "18:00");
    } catch {
      toast.error("Failed to load store details");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/seller/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about, open_time: openTime, close_time: closeTime }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setProfile(data);
      toast.success("Store details updated.");
    } catch {
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!profile) return;
    setToggling(true);
    try {
      const res = await fetch("/api/seller/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_active: !profile.store_active }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setProfile(data);
      toast.success(data.store_active ? "Store is now open." : "Store is now closed.");
    } catch {
      toast.error("Failed to update store status.");
    } finally {
      setToggling(false);
    }
  };

  if (!initialized || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center"><p>Loading...</p></div>;
  }

  const userType = (user?.user_type || "buyer").toLowerCase();
  if (userType !== "seller") { router.push("/dashboard/buyer"); return null; }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl px-6 py-8">
          <Skeleton className="mb-6 h-10 w-48" />
          <Skeleton className="mb-4 h-32 w-full" />
          <Skeleton className="mb-4 h-48 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3800ff]/10">
              <Store className="h-5 w-5 text-[#3800ff]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Store</h1>
              <p className="text-sm text-muted-foreground">{profile?.brand_name}</p>
            </div>
          </div>
          {profile && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/store/${profile.brand_slug}`} target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" /> View Store
              </Link>
            </Button>
          )}
        </div>

        {/* Status card */}
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              {profile?.store_active ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-semibold text-foreground">
                  Store is {profile?.store_active ? "Open" : "Closed"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {profile?.store_active
                    ? "Customers can browse and buy your products"
                    : "Your store is hidden from customers"}
                </p>
              </div>
            </div>
            <Button
              variant={profile?.store_active ? "outline" : "default"}
              size="sm"
              onClick={handleToggle}
              disabled={toggling}
              className={profile?.store_active ? "" : "bg-[#3800ff] text-white hover:bg-[#2d00d4]"}
            >
              {toggling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : profile?.store_active ? (
                "Close Store"
              ) : (
                "Open Store"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Edit details */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground">Store Details</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="about" className="mb-1.5 block text-sm">About your store</Label>
                <textarea
                  id="about"
                  value={about}
                  onChange={e => setAbout(e.target.value)}
                  rows={4}
                  placeholder="Tell customers what you sell..."
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#3800ff] resize-none"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="open_time" className="mb-1.5 block text-sm">
                    <Clock className="mr-1 inline h-3.5 w-3.5" /> Open Time
                  </Label>
                  <Input
                    id="open_time"
                    type="time"
                    value={openTime}
                    onChange={e => setOpenTime(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="close_time" className="mb-1.5 block text-sm">
                    <Clock className="mr-1 inline h-3.5 w-3.5" /> Close Time
                  </Label>
                  <Input
                    id="close_time"
                    type="time"
                    value={closeTime}
                    onChange={e => setCloseTime(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="mt-5 bg-[#3800ff] text-white hover:bg-[#2d00d4]"
            >
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Save Changes</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Store link */}
        {profile?.brand_slug && (
          <Card>
            <CardContent className="p-5">
              <h2 className="mb-2 text-base font-semibold text-foreground">Your Store Link</h2>
              <div className="flex items-center gap-3 rounded-xl border bg-muted px-4 py-3">
                <span className="flex-1 truncate text-sm text-muted-foreground">
                  {typeof window !== "undefined" ? window.location.origin : ""}/store/{profile.brand_slug}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/store/${profile.brand_slug}`);
                    toast.success("Link copied!");
                  }}
                >
                  Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

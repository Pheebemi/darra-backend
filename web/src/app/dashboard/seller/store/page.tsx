"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Store,
  Clock,
  ExternalLink,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  ImagePlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getImageUrl } from "@/lib/utils";

interface StoreProfile {
  brand_name: string;
  brand_slug: string;
  about: string;
  open_time: string;
  close_time: string;
  store_active: boolean;
  banner_url: string | null;
}

const MAX_BANNER_KB = 100;

export default function SellerStorePage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [about, setAbout] = useState("");
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("18:00");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

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

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BANNER_KB * 1024) {
      toast.error(`Banner must be ${MAX_BANNER_KB} KB or smaller.`);
      e.target.value = "";
      return;
    }
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const clearBanner = () => {
    setBannerFile(null);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(null);
    if (bannerInputRef.current) bannerInputRef.current.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let res: Response;
      if (bannerFile) {
        const form = new FormData();
        form.append("about", about);
        form.append("open_time", openTime);
        form.append("close_time", closeTime);
        form.append("banner", bannerFile);
        res = await fetch("/api/seller/store", { method: "PATCH", body: form });
      } else {
        res = await fetch("/api/seller/store", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ about, open_time: openTime, close_time: closeTime }),
        });
      }
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setProfile(data);
      clearBanner();
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
          <Skeleton className="mb-4 h-40 w-full" />
          <Skeleton className="mb-4 h-48 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  const currentBanner = bannerPreview || (profile?.banner_url ? getImageUrl(profile.banner_url) : null);

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
          {profile?.brand_slug && (
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

        {/* Banner */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <h2 className="mb-3 text-base font-semibold text-foreground">Store Banner</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Shown at the top of your public store page. Max {MAX_BANNER_KB} KB — keep it tight for fast loads.
            </p>

            {/* Preview */}
            <div className="relative mb-3 h-32 w-full overflow-hidden rounded-xl border bg-gradient-to-br from-[#3800ff] to-[#7c3aed]">
              {currentBanner && (
                <img
                  src={currentBanner}
                  alt="Banner preview"
                  className="h-full w-full object-cover"
                />
              )}
              {bannerFile && (
                <button
                  type="button"
                  onClick={clearBanner}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/70"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {currentBanner ? "Change" : "Upload Banner"}
              </button>
            </div>

            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerChange}
            />
            <p className="text-[11px] text-muted-foreground">
              Recommended: 1200×300 px · JPG or PNG · Max {MAX_BANNER_KB} KB
            </p>
          </CardContent>
        </Card>

        {/* Edit details */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground">Store Details</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="about" className="mb-1.5 block text-sm">About your store</Label>
                <RichTextEditor
                  value={about}
                  onChange={setAbout}
                  placeholder="Tell customers what you sell, your specialties, and what makes you unique..."
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

"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  User,
  Bell,
  Shield,
  Globe,
  HelpCircle,
  ArrowRight,
} from "lucide-react";

export default function SettingsPage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, initialized, router]);

  if (!initialized || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-foreground/70">Loading...</p>
      </div>
    );
  }

  const userType = (user?.user_type || "buyer").toLowerCase();
  if (userType !== "seller") {
    router.push("/dashboard/buyer");
    return null;
  }

  const settingsItems = [
    {
      title: "Bank Details",
      description: "Manage your bank accounts for payouts",
      icon: CreditCard,
      href: "/dashboard/seller/settings/bank-details",
    },
    {
      title: "Profile",
      description: "Update your profile information",
      icon: User,
      href: "/dashboard/seller/settings/profile",
      disabled: true,
    },
    {
      title: "Notifications",
      description: "Manage your notification preferences",
      icon: Bell,
      href: "/dashboard/seller/settings/notifications",
      disabled: true,
    },
    {
      title: "Security",
      description: "Change password and security settings",
      icon: Shield,
      href: "/dashboard/seller/settings/security",
      disabled: true,
    },
    {
      title: "Language & Region",
      description: "Set your language and region preferences",
      icon: Globe,
      href: "/dashboard/seller/settings/language",
      disabled: true,
    },
    {
      title: "Help & Support",
      description: "Get help and contact support",
      icon: HelpCircle,
      href: "/dashboard/seller/settings/help",
      disabled: true,
    },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="space-y-4">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            const isDisabled = item.disabled;

            if (isDisabled) {
              return (
                <Card key={item.href} className="opacity-60">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{item.title}</h3>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{item.title}</h3>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}



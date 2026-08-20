"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
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
      <div className="mx-auto max-w-4xl p-6 sm:p-8">
        <div className="mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent-link">Account</p>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-body">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            const isDisabled = item.disabled;

            const inner = (
              <div className={`group flex h-full items-center justify-between rounded-3xl border border-line bg-surface p-6 transition-shadow duration-300 ${isDisabled ? "opacity-60" : "hover:shadow-xl"}`}>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-softer">
                    <Icon className="h-6 w-6 text-accent-link" />
                  </div>
                  <div>
                    <h3 className={`font-semibold text-ink ${isDisabled ? "" : "transition-colors group-hover:text-accent-link"}`}>
                      {item.title}
                      {isDisabled && <span className="ml-2 rounded-full bg-inset px-2 py-0.5 text-[10px] font-medium text-subtle">Soon</span>}
                    </h3>
                    <p className="text-sm text-body">{item.description}</p>
                  </div>
                </div>
                <ArrowRight className={`h-5 w-5 shrink-0 text-faint ${isDisabled ? "" : "transition-transform group-hover:translate-x-0.5 group-hover:text-accent-link"}`} />
              </div>
            );

            if (isDisabled) {
              return <div key={item.href}>{inner}</div>;
            }

            return (
              <Link key={item.href} href={item.href}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}



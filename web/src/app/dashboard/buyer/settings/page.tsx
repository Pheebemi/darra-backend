"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { User, Shield, ArrowRight } from "lucide-react";

export default function BuyerSettingsPage() {
  const { user, isAuthenticated, initialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (initialized && !isAuthenticated) router.push("/login");
  }, [isAuthenticated, initialized, router]);

  if (!initialized || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center"><p>Loading...</p></div>;
  }

  const settingsItems = [
    {
      title: "Edit Profile",
      description: "Update your name and account info",
      icon: User,
      href: "/dashboard/buyer/settings/profile",
    },
    {
      title: "Change Password",
      description: "Update your password",
      icon: Shield,
      href: "/dashboard/buyer/settings/security",
    },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl p-6 sm:p-8">
        <div className="mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-accent-link">Account</p>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-body">Manage your account</p>
        </div>

        <div className="space-y-4">
          {settingsItems.map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div className="group flex items-center justify-between rounded-3xl border border-line bg-surface p-6 transition-shadow duration-300 hover:shadow-xl">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-softer">
                      <Icon className="h-6 w-6 text-accent-link" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink transition-colors group-hover:text-accent-link">{item.title}</h3>
                      <p className="text-sm text-body">{item.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent-link" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}

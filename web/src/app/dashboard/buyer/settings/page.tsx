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
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-500">Account</p>
          <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-gray-600">Manage your account</p>
        </div>

        <div className="space-y-4">
          {settingsItems.map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div className="group flex items-center justify-between rounded-3xl border border-gray-100 bg-white p-6 transition-shadow duration-300 hover:shadow-xl">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-100">
                      <Icon className="h-6 w-6 text-brand-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink transition-colors group-hover:text-brand-500">{item.title}</h3>
                      <p className="text-sm text-gray-600">{item.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}

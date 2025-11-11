"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingBag,
  Ticket,
  TrendingUp,
  Heart,
  Settings,
  LogOut,
  Package,
  DollarSign,
  Users,
  BarChart3,
  QrCode,
  Plus,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const buyerItems: SidebarItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard/buyer",
    icon: LayoutDashboard,
  },
  {
    title: "Browse Tickets",
    href: "/tickets",
    icon: ShoppingBag,
  },
  {
    title: "My Tickets",
    href: "/account/tickets",
    icon: Ticket,
  },
  {
    title: "Trending",
    href: "/tickets?filter=trending",
    icon: TrendingUp,
  },
  {
    title: "Saved",
    href: "/account/saved",
    icon: Heart,
  },
];

const sellerItems: SidebarItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard/seller",
    icon: LayoutDashboard,
  },
  {
    title: "My Events",
    href: "/dashboard/seller/events",
    icon: Package,
  },
  {
    title: "Create Event",
    href: "/dashboard/seller/create-event",
    icon: Plus,
  },
  {
    title: "Verify Tickets",
    href: "/scan",
    icon: QrCode,
  },
  {
    title: "Analytics",
    href: "/dashboard/seller/analytics",
    icon: BarChart3,
  },
  {
    title: "Earnings",
    href: "/dashboard/seller/earnings",
    icon: DollarSign,
  },
  {
    title: "Customers",
    href: "/dashboard/seller/customers",
    icon: Users,
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const userType = (user?.user_type || "buyer").toLowerCase();
  const items = userType === "seller" ? sellerItems : buyerItems;

  return (
    <aside className="fixed left-0 top-16 z-30 h-[calc(100vh-4rem)] w-64 border-r bg-background">
      <div className="flex h-full flex-col">
        <nav className="flex-1 space-y-1 p-4">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-4">
          <div className="mb-4 space-y-1">
            <Link
              href="/dashboard/seller/settings"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.includes("/settings")
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:bg-accent hover:text-foreground"
              )}
            >
              <Settings className="h-5 w-5" />
              Settings
            </Link>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-foreground/70 hover:text-foreground"
            onClick={logout}
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </Button>
        </div>
      </div>
    </aside>
  );
}



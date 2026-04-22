"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Plus,
  ShoppingCart,
  QrCode,
  DollarSign,
  Settings,
  LogOut,
  ShoppingBag,
  Library,
  TrendingUp,
  ShoppingBag as BrowseIcon,
  TicketCheck,
  User,
  Store,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const sellerNav: NavItem[] = [
  { title: "Overview",     href: "/dashboard/seller",                    icon: LayoutDashboard },
  { title: "Products",     href: "/dashboard/seller/inventory",          icon: Package },
  { title: "Add Product",  href: "/dashboard/seller/create-event",       icon: Plus },
  { title: "Orders",       href: "/dashboard/seller/orders",             icon: ShoppingCart },
  { title: "Purchases",    href: "/dashboard/seller/tickets",            icon: TicketCheck },
  { title: "Verify QR",    href: "/dashboard/seller/verify-tickets",     icon: QrCode },
  { title: "Earnings",     href: "/dashboard/seller/earnings",           icon: DollarSign },
  { title: "My Store",    href: "/dashboard/seller/store",              icon: Store },
];

const sellerBottom: NavItem[] = [
  { title: "Settings",     href: "/dashboard/seller/settings",           icon: Settings },
];

const buyerNav: NavItem[] = [
  { title: "Overview",     href: "/dashboard/buyer",                     icon: LayoutDashboard },
  { title: "My Library",   href: "/dashboard/buyer/library",             icon: Library },
  { title: "Browse",       href: "/products",                            icon: BrowseIcon },
  { title: "Cart",         href: "/cart",                                icon: ShoppingCart },
];

function NavLink({
  item,
  onClick,
}: {
  item: NavItem;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href ||
    (item.href !== "/dashboard/seller" &&
      item.href !== "/dashboard/buyer" &&
      pathname.startsWith(item.href + "/"));
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.title}
    </Link>
  );
}

export function DashboardSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const userType = (user?.user_type || "buyer").toLowerCase();
  const nav = userType === "seller" ? sellerNav : buyerNav;
  const bottomNav = userType === "seller" ? sellerBottom : [];

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold" onClick={onNavigate}>
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
            <ShoppingBag className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm">Darra</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} onClick={onNavigate} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t px-3 py-3 space-y-0.5">
        {bottomNav.map((item) => (
          <NavLink key={item.href} item={item} onClick={onNavigate} />
        ))}

        {/* User row */}
        <div className="mt-2 flex items-center gap-2.5 rounded-md px-2.5 py-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium leading-none">{user?.full_name || "User"}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={() => { logout(); onNavigate?.(); }}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </button>
      </div>
    </div>
  );
}

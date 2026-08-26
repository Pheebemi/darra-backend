"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LayoutDashboard,
  Package,
  Plus,
  ShoppingCart,
  QrCode,
  DollarSign,
  Settings,
  LogOut,
  Library,
  ShoppingBag as BrowseIcon,
  TicketCheck,
  User,
  Store,
  Tag,
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
  { title: "Discounts",    href: "/dashboard/seller/discounts",          icon: Tag },
  { title: "Verify QR",    href: "/dashboard/seller/verify-tickets",     icon: QrCode },
  { title: "Earnings",     href: "/dashboard/seller/earnings",           icon: DollarSign },
  { title: "My Store",    href: "/dashboard/seller/store",              icon: Store },
];

const sellerBottom: NavItem[] = [
  { title: "Settings",     href: "/dashboard/seller/settings",           icon: Settings },
];

const buyerBottom: NavItem[] = [
  { title: "Settings",     href: "/dashboard/buyer/settings",            icon: Settings },
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
        "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors",
        isActive
          ? "bg-brand-500 font-medium text-white"
          : "text-brand-200/80 hover:bg-white/10 hover:text-white"
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
  const bottomNav = userType === "seller" ? sellerBottom : buyerBottom;

  return (
    <div className="flex h-full flex-col bg-ink-dark">
      {/* Logo */}
      <div className="flex h-16 items-center px-5">
        <Link href="/" className="flex items-center gap-2.5" onClick={onNavigate}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
            <img src="/logo.svg" alt="Darra" className="h-7 w-auto" />
          </div>
          <span className="text-base font-semibold text-white">Darra</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((item) => (
          <NavLink key={item.href} item={item} onClick={onNavigate} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="space-y-1 border-t border-white/10 px-3 py-4">
        {bottomNav.map((item) => (
          <NavLink key={item.href} item={item} onClick={onNavigate} />
        ))}

        {/* User row */}
        <div className="mt-2 flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/30 text-brand-200">
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium leading-none text-white">{user?.full_name || "User"}</p>
            <p className="mt-1 truncate text-[11px] text-brand-200/60">{user?.email}</p>
          </div>
          <ThemeToggle tone="onDark" className="shrink-0" />
        </div>

        <button
          onClick={() => { logout(); onNavigate?.(); }}
          className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm text-brand-200/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Logout
        </button>
      </div>
    </div>
  );
}

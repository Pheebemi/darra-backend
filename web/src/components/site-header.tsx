"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/auth-context";
import { useCart } from "@/lib/cart/cart-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShoppingCart, User, LogOut, LayoutDashboard, Menu, Library, Search, Store } from "lucide-react";
import { useState } from "react";

export function SiteHeader() {
  const { user, isAuthenticated, logout, initialized } = useAuth();
  const { getItemCount } = useCart();
  const cartCount = getItemCount();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-[999] w-full bg-page/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-page/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:px-16">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white ring-1 ring-gray-200">
            <img src="/logo.svg" alt="Darra" className="h-8 w-auto" />
          </div>
          <span className="text-lg font-semibold text-ink">Darra</span>
        </Link>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="mx-6 hidden max-w-sm flex-1 md:flex">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="h-10 rounded-full border-gray-200 bg-white pl-11 pr-4 focus-visible:ring-brand-300"
            />
          </div>
        </form>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/products" className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-brand-50 hover:text-brand-600">
            Browse
          </Link>
          <Link href="/stores" className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-brand-50 hover:text-brand-600">
            Stores
          </Link>
          {isAuthenticated && (
            <Link href="/cart" className="relative rounded-full p-2 text-gray-600 transition-colors hover:bg-brand-50 hover:text-brand-600">
              <ShoppingCart className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-medium text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          )}
        </nav>

        {/* Desktop auth */}
        <div className="hidden items-center gap-2 md:flex">
          {initialized && (
            isAuthenticated ? (
              <div className="flex items-center gap-1">
                <Link href={(user?.user_type || "buyer").toLowerCase() === "seller" ? "/dashboard/seller" : "/dashboard/buyer"}
                  className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-brand-50 hover:text-brand-600">
                  Dashboard
                </Link>
                <Link href="/dashboard/buyer/library"
                  className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-brand-50 hover:text-brand-600">
                  My Library
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 rounded-full px-2 py-1.5 transition-colors hover:bg-brand-50">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-500">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <span className="max-w-24 truncate text-xs font-medium text-gray-600">{user?.full_name || user?.email || "Account"}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-2xl">
                    <div className="px-3 py-2">
                      <p className="truncate text-xs font-medium">{user?.full_name || "User"}</p>
                      <p className="truncate text-xs text-gray-500">{user?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                      <LogOut className="h-3.5 w-3.5" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-full bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 focus:outline-none focus:ring focus:ring-brand-300 active:bg-brand-700"
              >
                Sign in
              </Link>
            )
          )}
        </div>

        {/* Mobile menu button */}
        <button onClick={() => setOpen(!open)} className="rounded-full p-2 text-gray-600 hover:bg-brand-50 md:hidden">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-brand-100 bg-page md:hidden">
          <div className="space-y-0.5 px-5 py-4">
            <form onSubmit={handleSearch} className="mb-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="h-10 rounded-full border-gray-200 bg-white pl-11 pr-4 focus-visible:ring-brand-300"
                />
              </div>
            </form>
            <Link href="/products" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-brand-50 hover:text-brand-600">
              Browse Products
            </Link>
            <Link href="/stores" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-brand-50 hover:text-brand-600">
              <Store className="h-4 w-4" /> Stores
            </Link>
            {isAuthenticated && (
              <>
                <Link href="/cart" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-brand-50 hover:text-brand-600">
                  <ShoppingCart className="h-4 w-4" /> Cart
                  {cartCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-medium text-white">
                      {cartCount}
                    </span>
                  )}
                </Link>
                <Link href={(user?.user_type || "buyer").toLowerCase() === "seller" ? "/dashboard/seller" : "/dashboard/buyer"} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-brand-50 hover:text-brand-600">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
                <Link href="/dashboard/buyer/library" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-brand-50 hover:text-brand-600">
                  <Library className="h-4 w-4" /> My Library
                </Link>
                <div className="mt-2 border-t border-brand-100 pt-2">
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-500">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{user?.full_name}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                  </div>
                  <button onClick={() => { logout(); setOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[#b3261e] hover:bg-red-50">
                    <LogOut className="h-4 w-4" /> Logout
                  </button>
                </div>
              </>
            )}
            {!isAuthenticated && initialized && (
              <div className="pt-2">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="block w-full rounded-full bg-brand-500 px-6 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-brand-600"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

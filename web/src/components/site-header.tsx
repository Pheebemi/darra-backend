"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth/auth-context";
import { useCart } from "@/lib/cart/cart-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger, // Added missing import
} from "@/components/ui/dropdown-menu";
import { 
  ShoppingCart, 
  User, 
  LogOut, 
  LayoutDashboard, 
  Ticket,
  Menu,
  Search
} from "lucide-react";
import { useState } from "react";

export function SiteHeader() {
  const { user, isAuthenticated, logout, initialized } = useAuth();
  const { getItemCount } = useCart();
  const cartCount = getItemCount();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:border-slate-700/50 dark:bg-slate-900/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link 
          href="/" 
          className="flex items-center gap-2 text-xl font-bold tracking-tight"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white">
            <Ticket className="h-4 w-4" />
          </div>
          <span className="bg-gradient-to-br from-slate-900 to-blue-700 dark:from-slate-100 dark:to-blue-400 bg-clip-text text-transparent">
            Darra
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link 
            href="/tickets" 
            className="text-sm font-medium text-slate-700 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
          >
            Browse Tickets
          </Link>
          
          {isAuthenticated && (
            <Link 
              href="/cart" 
              className="relative transition-colors hover:text-blue-600 dark:hover:text-blue-400"
            >
              <ShoppingCart className="h-5 w-5 text-slate-700 dark:text-slate-300" />
              {cartCount > 0 && (
                <Badge className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 p-0 text-xs text-white dark:border-slate-900">
                  {cartCount}
                </Badge>
              )}
            </Link>
          )}
        </nav>

        {/* Desktop Auth Section */}
        <div className="hidden items-center gap-4 md:flex">
          {initialized && (
            <>
              {isAuthenticated ? (
                <div className="flex items-center gap-4">
                  {/* Search Icon */}
                  <Button variant="ghost" size="sm" className="rounded-xl">
                    <Search className="h-4 w-4" />
                  </Button>

                  {/* Dashboard Links */}
                  {(user?.user_type || "buyer").toLowerCase() === "seller" ? (
                    <Link
                      href="/dashboard/seller"
                      className="text-sm font-medium text-slate-700 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                    >
                      Dashboard
                    </Link>
                  ) : (
                    <Link
                      href="/dashboard/buyer"
                      className="text-sm font-medium text-slate-700 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                    >
                      Dashboard
                    </Link>
                  )}
                  
                  <Link
                    href="/account/tickets"
                    className="text-sm font-medium text-slate-700 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
                  >
                    My Tickets
                  </Link>

                  {/* User Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center gap-2 rounded-xl px-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100 text-blue-600 dark:from-blue-900/50 dark:to-purple-900/50 dark:text-blue-400">
                          <User className="h-4 w-4" />
                        </div>
                        <span className="max-w-32 truncate text-sm font-medium">
                          {user?.full_name || user?.email || "Account"}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="end" 
                      className="w-56 rounded-xl border-slate-200/50 bg-white/80 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-800/80"
                    >
                      <div className="flex items-center gap-2 p-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100 text-blue-600 dark:from-blue-900/50 dark:to-purple-900/50 dark:text-blue-400">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium truncate">
                            {user?.full_name || "User"}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                            {user?.email}
                          </p>
                        </div>
                      </div>
                      <DropdownMenuSeparator className="bg-slate-200/50 dark:bg-slate-700/50" />
                      <DropdownMenuItem 
                        onClick={logout}
                        className="flex cursor-pointer items-center gap-2 text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <Button asChild size="sm" className="rounded-xl bg-blue-600 hover:bg-blue-700">
                  <Link href="/login">Sign in</Link>
                </Button>
              )}
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="flex items-center justify-center rounded-xl p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="border-t border-slate-200/50 bg-white/95 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/95 md:hidden">
          <div className="px-4 py-4 space-y-4">
            {/* Navigation Links */}
            <Link
              href="/tickets"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Browse Tickets
            </Link>

            {isAuthenticated && (
              <>
                <Link
                  href="/cart"
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Cart
                  {cartCount > 0 && (
                    <Badge className="ml-auto bg-red-500 text-xs text-white">
                      {cartCount}
                    </Badge>
                  )}
                </Link>

                {(user?.user_type || "buyer").toLowerCase() === "seller" ? (
                  <Link
                    href="/dashboard/seller"
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                ) : (
                  <Link
                    href="/dashboard/buyer"
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                )}

                <Link
                  href="/account/tickets"
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Ticket className="h-4 w-4" />
                  My Tickets
                </Link>

                <div className="border-t border-slate-200/50 pt-4 dark:border-slate-700/50">
                  <div className="flex items-center gap-3 px-3 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100 text-blue-600 dark:from-blue-900/50 dark:to-purple-900/50 dark:text-blue-400">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {user?.full_name || "User"}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </>
            )}

            {!isAuthenticated && initialized && (
              <Button 
                asChild 
                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
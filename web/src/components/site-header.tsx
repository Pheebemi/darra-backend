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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShoppingCart, User, LogOut, LayoutDashboard, Menu, ShoppingBag, Library } from "lucide-react";
import { useState } from "react";

export function SiteHeader() {
  const { user, isAuthenticated, logout, initialized } = useAuth();
  const { getItemCount } = useCart();
  const cartCount = getItemCount();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <ShoppingBag className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm">Darra</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/products" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            Browse
          </Link>
          {isAuthenticated && (
            <Link href="/cart" className="relative rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
              <ShoppingCart className="h-4 w-4" />
              {cartCount > 0 && (
                <Badge className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[10px]">
                  {cartCount}
                </Badge>
              )}
            </Link>
          )}
        </nav>

        {/* Desktop auth */}
        <div className="hidden items-center gap-2 md:flex">
          {initialized && (
            isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link href={(user?.user_type || "buyer").toLowerCase() === "seller" ? "/dashboard/seller" : "/dashboard/buyer"}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                  Dashboard
                </Link>
                <Link href="/dashboard/buyer/library"
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
                  My Library
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 px-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <span className="max-w-24 truncate text-xs">{user?.full_name || user?.email || "Account"}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-lg">
                    <div className="px-3 py-2">
                      <p className="text-xs font-medium truncate">{user?.full_name || "User"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
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
              <Button size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            )
          )}
        </div>

        {/* Mobile menu button */}
        <button onClick={() => setOpen(!open)} className="rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden">
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t bg-background md:hidden">
          <div className="space-y-0.5 px-4 py-3">
            <Link href="/products" onClick={() => setOpen(false)} className="flex items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
              Browse Products
            </Link>
            {isAuthenticated && (
              <>
                <Link href="/cart" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
                  <ShoppingCart className="h-4 w-4" /> Cart
                  {cartCount > 0 && <Badge className="ml-auto h-4 rounded-full px-1.5 text-[10px]">{cartCount}</Badge>}
                </Link>
                <Link href={(user?.user_type || "buyer").toLowerCase() === "seller" ? "/dashboard/seller" : "/dashboard/buyer"} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
                <Link href="/dashboard/buyer/library" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
                  <Library className="h-4 w-4" /> My Library
                </Link>
                <div className="border-t pt-2 mt-2">
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-3 w-3" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{user?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <button onClick={() => { logout(); setOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10">
                    <LogOut className="h-4 w-4" /> Logout
                  </button>
                </div>
              </>
            )}
            {!isAuthenticated && initialized && (
              <div className="pt-1">
                <Button size="sm" className="w-full" asChild onClick={() => setOpen(false)}>
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

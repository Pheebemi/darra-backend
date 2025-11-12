"use client";
import { useState } from "react";
import { DashboardSidebar } from "./sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Mobile Top Bar */}
      <div className="sticky top-16 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-xl">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="px-4 py-3 border-b">
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <div className="h-[calc(100dvh-3.5rem)] overflow-y-auto">
                <DashboardSidebar onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="text-sm font-medium text-foreground/80">Dashboard</div>
          <div className="w-9" />
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[240px_1fr] md:gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block">
          <div className="sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto">
            <DashboardSidebar />
          </div>
        </aside>

        {/* Main Content */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}



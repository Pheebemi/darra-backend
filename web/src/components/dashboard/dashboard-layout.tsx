"use client";
import { DashboardSidebar } from "./sidebar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <DashboardSidebar />
      <main className="ml-64 flex-1">{children}</main>
    </div>
  );
}



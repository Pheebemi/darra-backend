"use client";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SupportChat } from "@/components/support-chat";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");

  // The support widget is for customers browsing the store, so it stays off
  // the dashboard where it would sit on top of the sidebar and page actions.
  if (isDashboard) {
    return <>{children}</>;
  }

  return (
    <>
      <SiteHeader />
      <main className="min-h-[calc(100dvh-8rem)]">{children}</main>
      <SiteFooter />
      <SupportChat />
    </>
  );
}

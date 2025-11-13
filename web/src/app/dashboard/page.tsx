"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";

export default function DashboardRedirect() {
  const { user, initialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    if (!user) {
      router.push("/login");
      return;
    }

    const userType = (user.user_type || "buyer").toLowerCase();
    if (userType === "seller") {
      router.replace("/dashboard/seller");
    } else {
      router.replace("/dashboard/buyer");
    }
  }, [user, initialized, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-foreground/70">Redirecting...</p>
      </div>
    </div>
  );
}






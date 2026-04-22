"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AccountTicketsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/buyer/library"); }, [router]);
  return null;
}

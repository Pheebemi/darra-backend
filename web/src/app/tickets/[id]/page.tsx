"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function TicketDetailRedirect() {
  const params = useParams();
  const router = useRouter();
  useEffect(() => { router.replace(`/products/${params.id}`); }, [params.id, router]);
  return null;
}

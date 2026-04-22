import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brand_slug: string }> }
) {
  try {
    const { brand_slug } = await params;
    const response = await apiClient.get(`/auth/store/${brand_slug}/`);
    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || "Store not found";
    return NextResponse.json({ message }, { status });
  }
}

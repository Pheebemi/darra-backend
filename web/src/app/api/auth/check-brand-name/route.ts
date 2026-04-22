import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

export async function GET(request: NextRequest) {
  try {
    const brandName = request.nextUrl.searchParams.get("brand_name") || "";
    const response = await apiClient.get(`/auth/check-brand-name/?brand_name=${encodeURIComponent(brandName)}`);
    return NextResponse.json(response.data);
  } catch (error: any) {
    return NextResponse.json({ available: null }, { status: error.response?.status || 500 });
  }
}

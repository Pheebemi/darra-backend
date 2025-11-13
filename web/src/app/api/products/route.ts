import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getAuthCookies } from "@/lib/auth/cookies";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const productType = searchParams.get("product_type");
    const ticketCategory = searchParams.get("ticket_category");

    const queryParams = new URLSearchParams();
    if (productType) queryParams.append("product_type", productType);
    if (ticketCategory) queryParams.append("ticket_category", ticketCategory);

    const url = `/products/${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const response = await apiClient.get(url);

    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      error.message ||
      "Failed to fetch products";

    return NextResponse.json({ message }, { status });
  }
}






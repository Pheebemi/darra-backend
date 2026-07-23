import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

/** Store list — search and paging are handled by the backend. */
export async function GET(request: NextRequest) {
  try {
    const incoming = request.nextUrl.searchParams;
    const queryParams = new URLSearchParams();

    for (const key of ["search", "page", "page_size"]) {
      const value = incoming.get(key);
      if (value) queryParams.append(key, value);
    }

    const qs = queryParams.toString();
    const response = await apiClient.get(`/auth/stores/${qs ? `?${qs}` : ""}`);

    return NextResponse.json(response.data);
  } catch (error: any) {
    return NextResponse.json(
      { message: "Failed to fetch stores" },
      { status: error.response?.status || 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

export async function GET(request: NextRequest) {
  try {
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "7d";

    const response = await apiClient.get(
      `/products/analytics/?time_range=${timeRange}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      error.message ||
      "Failed to fetch analytics";

    return NextResponse.json({ message }, { status });
  }
}



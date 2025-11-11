import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getAuthCookies } from "@/lib/auth/cookies";

export async function GET(request: NextRequest) {
  try {
    const { accessToken } = await getAuthCookies();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const response = await apiClient.get("/auth/profile/", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      error.message ||
      "Failed to fetch profile";

    return NextResponse.json({ message }, { status });
  }
}




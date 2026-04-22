import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

    const body = await request.json();
    const response = await apiClient.post("/auth/update-password/", body, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return NextResponse.json(response.data);
  } catch (error: any) {
    const data = error.response?.data;
    return NextResponse.json(
      { message: data?.message || data?.old_password?.[0] || data?.new_password?.[0] || "Failed to update password" },
      { status: error.response?.status || 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

export async function GET() {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    const response = await apiClient.get("/auth/profile/", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return NextResponse.json(response.data);
  } catch (error: any) {
    return NextResponse.json({ message: "Failed to fetch store" }, { status: error.response?.status || 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    const body = await request.json();
    const response = await apiClient.patch("/auth/profile/", body, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return NextResponse.json(response.data);
  } catch (error: any) {
    const data = error.response?.data;
    return NextResponse.json(
      { message: data?.message || data?.detail || "Failed to update store" },
      { status: error.response?.status || 500 }
    );
  }
}

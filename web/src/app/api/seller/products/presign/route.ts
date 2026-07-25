import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

// Tiny JSON call: hands back a short-lived presigned R2 URL so the browser can
// upload a product file straight to Cloudflare, bypassing this serverless
// function's 4.5MB body limit. The file bytes never pass through here.
export async function POST(request: NextRequest) {
  try {
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();

    const response = await apiClient.post("/products/upload/presign/", body, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      "Failed to start the upload";

    return NextResponse.json({ message }, { status });
  }
}

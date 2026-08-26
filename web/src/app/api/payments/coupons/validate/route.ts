import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";
import { apiError } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const response = await apiClient.post("/payments/coupons/validate/", body, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return NextResponse.json(response.data);
  } catch (error) {
    const { status, message } = apiError(error, "Could not apply that code");
    return NextResponse.json({ message }, { status });
  }
}

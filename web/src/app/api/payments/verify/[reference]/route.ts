import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const accessToken = await getValidAccessToken();
    const { reference } = await params;

    // Try protected verify first when we have a token
    if (accessToken) {
      try {
        const response = await apiClient.get(`/payments/verify/${reference}/`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        return NextResponse.json(response.data);
      } catch (err: any) {
        // If unauthorized, fall through to public status check
        if (err?.response?.status !== 401) {
          throw err;
        }
      }
    }

    // Public fallback: check-status does not require auth
    const statusResponse = await apiClient.get(`/payments/check-status/${reference}/`);
    return NextResponse.json({ payment: statusResponse.data });
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      error.message ||
      "Failed to verify payment";

    return NextResponse.json({ message }, { status });
  }
}


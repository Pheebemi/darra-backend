import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const response = await apiClient.post(`/events/verify/${id}/`, {}, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    let message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Failed to verify ticket";

    // Handle specific error cases
    if (error.response?.data?.error) {
      message = error.response.data.error;
    }

    return NextResponse.json({ message }, { status });
  }
}

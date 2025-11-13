import { NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const response = await apiClient.post(`/events/verify/${id}/`, {}, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Failed to verify ticket";

    return NextResponse.json({ message }, { status });
  }
}



import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";
import { apiError } from "@/lib/api/errors";

/** Publish or unpublish one of the seller's own products. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const response = await apiClient.post(
      `/products/my-products/${id}/publish/`,
      body,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    return NextResponse.json(response.data);
  } catch (error) {
    const { status, message } = apiError(error, "Failed to update publish state");
    return NextResponse.json({ message }, { status });
  }
}

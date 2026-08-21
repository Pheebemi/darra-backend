import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";
import { apiError } from "@/lib/api/errors";

/**
 * Public product detail.
 *
 * The token is forwarded when the visitor happens to be signed in. Anonymous
 * callers still get the public view, but a seller opening their own
 * unpublished product needs the backend to recognise them — without the
 * header every draft 404s here, including for its owner.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = await getValidAccessToken();

    const response = await apiClient.get(
      `/products/${id}/`,
      accessToken
        ? { headers: { Authorization: `Bearer ${accessToken}` } }
        : undefined
    );

    return NextResponse.json(response.data);
  } catch (error) {
    const { status, message } = apiError(error, "Failed to fetch product");
    return NextResponse.json({ message }, { status });
  }
}

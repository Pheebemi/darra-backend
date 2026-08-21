import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";
import { apiError } from "@/lib/api/errors";

/**
 * Product reviews.
 *
 * GET is public, but the token is forwarded when the visitor happens to be
 * signed in — the backend uses it to fill in `can_review` / `has_reviewed`,
 * which is what decides whether the write-a-review form is shown.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = await getValidAccessToken();
    const page = request.nextUrl.searchParams.get("page");

    const response = await apiClient.get(
      `/products/${id}/reviews/${page ? `?page=${page}` : ""}`,
      accessToken
        ? { headers: { Authorization: `Bearer ${accessToken}` } }
        : undefined
    );

    return NextResponse.json(response.data);
  } catch (error) {
    const { status, message } = apiError(error, "Failed to load reviews");
    return NextResponse.json({ message }, { status });
  }
}

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

    const body = await request.json();
    const response = await apiClient.post(`/products/${id}/reviews/`, body, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (error) {
    const { status, message } = apiError(error, "Failed to save review");
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    await apiClient.delete(`/products/${id}/reviews/mine/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const { status, message } = apiError(error, "Failed to delete review");
    return NextResponse.json({ message }, { status });
  }
}

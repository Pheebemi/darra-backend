import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

interface CouponErrorShape {
  response?: { status?: number; data?: { message?: string; value?: string[] } };
}

function couponError(error: unknown, fallback: string) {
  const err = (error ?? {}) as CouponErrorShape;
  const data = err.response?.data;
  return { status: err.response?.status ?? 500, message: data?.message || data?.value?.[0] || fallback };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const response = await apiClient.patch(`/products/coupons/${id}/`, body, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return NextResponse.json(response.data);
  } catch (error) {
    const { status, message } = couponError(error, "Failed to update discount code");
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    await apiClient.delete(`/products/coupons/${id}/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const { status, message } = couponError(error, "Failed to delete discount code");
    return NextResponse.json({ message }, { status });
  }
}

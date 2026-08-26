import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

interface CouponErrorShape {
  response?: {
    status?: number;
    data?: { message?: string; code?: string[]; value?: string[]; non_field_errors?: string[] };
  };
}

/**
 * DRF field errors for a coupon come back as {code: [...]} or {value: [...]}
 * — e.g. "Percentage discounts are capped at 50%" — rather than a single
 * `message`, so the generic apiError() helper would collapse them into a
 * useless fallback. Surface the actual field message instead.
 */
function couponError(error: unknown, fallback: string) {
  const err = (error ?? {}) as CouponErrorShape;
  const data = err.response?.data;
  return {
    status: err.response?.status ?? 500,
    message:
      data?.message || data?.code?.[0] || data?.value?.[0] || data?.non_field_errors?.[0] || fallback,
  };
}

export async function GET() {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const response = await apiClient.get("/products/coupons/", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return NextResponse.json(response.data);
  } catch (error) {
    const { status, message } = couponError(error, "Failed to load discount codes");
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const response = await apiClient.post("/products/coupons/", body, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return NextResponse.json(response.data, { status: 201 });
  } catch (error) {
    const { status, message } = couponError(error, "Failed to create discount code");
    return NextResponse.json({ message }, { status });
  }
}

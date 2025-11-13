import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { items, email, payment_provider = "paystack" } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: "Cart items are required" },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { message: "Email is required" },
        { status: 400 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      request.headers.get("origin") ??
      "https://darra.vercel.app";
const callbackUrl = `${siteUrl}/payment/callback`;
    const response = await apiClient.post(
      "/payments/checkout/",
      {
        items,
        email,
        callback_url: callbackUrl,
        payment_provider,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      error.message ||
      "Checkout failed. Please try again.";

    return NextResponse.json({ message }, { status });
  }
}


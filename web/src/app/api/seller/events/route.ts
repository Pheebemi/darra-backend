import { NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

export async function GET() {
  try {
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const response = await apiClient.get("/products/my-products/", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Filter to only return events (is_ticket_event = true)
    const events = response.data.filter(
      (product: any) => product.is_ticket_event === true
    );

    return NextResponse.json(events);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      error.message ||
      "Failed to fetch events";

    return NextResponse.json({ message }, { status });
  }
}



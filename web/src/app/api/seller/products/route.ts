import { NextRequest, NextResponse } from "next/server";
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

    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      error.message ||
      "Failed to fetch products";

    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const formData = await request.formData();

    // Convert FormData to a format axios can handle
    // Note: When using FormData with axios, don't set Content-Type header
    // axios will automatically set it with the correct boundary
    const response = await apiClient.post("/products/my-products/", formData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // Don't set Content-Type - let axios set it automatically for FormData
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    let message =
      error.response?.data?.message ||
      error.message ||
      "Failed to create product";

    // Handle validation errors
    if (error.response?.data?.details) {
      const details = error.response.data.details;
      const errorMessages = Object.values(details).flat();
      message = errorMessages.join(", ");
    }

    return NextResponse.json({ message }, { status });
  }
}


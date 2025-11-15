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

    const response = await apiClient.get("/payments/seller/payouts/", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Payouts API Error:", error);
    
    const status = error.response?.status || 500;
    const errorData = error.response?.data;
    
    let message = "Failed to fetch payout history";
    
    if (errorData) {
      if (errorData.error) {
        message = errorData.error;
      } else if (errorData.message) {
        message = errorData.message;
      } else if (typeof errorData === 'string') {
        message = errorData;
      } else if (errorData.detail) {
        message = errorData.detail;
      }
    } else if (error.message) {
      message = error.message;
    }

    return NextResponse.json(
      { 
        message,
        error: errorData || error.message,
        status 
      },
      { status }
    );
  }
}


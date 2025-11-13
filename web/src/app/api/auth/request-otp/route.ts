import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { message: "Email is required" },
        { status: 400 }
      );
    }

    const response = await apiClient.post("/auth/request-otp/", {
      email,
    });

    return NextResponse.json({
      message: response.data.message || "OTP sent successfully",
      email: response.data.email || email,
    });
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      "Failed to send OTP. Please try again.";

    return NextResponse.json({ message }, { status });
  }
}






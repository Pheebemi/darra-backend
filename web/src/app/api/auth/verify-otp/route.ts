import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { setAuthCookies } from "@/lib/auth/cookies";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, isLogin } = body;

    if (!email || !otp) {
      return NextResponse.json(
        { message: "Email and OTP are required" },
        { status: 400 }
      );
    }

    let response;
    if (isLogin) {
      // Login with OTP
      response = await apiClient.post("/auth/login/otp/", {
        email,
        otp,
      });
    } else {
      // Verify OTP for registration
      response = await apiClient.post("/auth/verify-otp/", {
        email,
        otp,
      });
    }

    const { tokens, user } = response.data;

    // If tokens are returned (login flow), store them
    if (tokens?.access && tokens?.refresh) {
      await setAuthCookies(tokens.access, tokens.refresh);
    }

    return NextResponse.json({
      message: isLogin ? "Login successful" : "Email verified successfully",
      user: user || response.data.user,
    });
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      "OTP verification failed. Please try again.";

    return NextResponse.json({ message }, { status });
  }
}







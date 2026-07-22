import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { setAuthCookies } from "@/lib/auth/cookies";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 }
      );
    }

    const response = await apiClient.post("/auth/login/", {
      email,
      password,
    });

    const { tokens, user } = response.data;

    if (tokens?.access && tokens?.refresh) {
      await setAuthCookies(tokens.access, tokens.refresh);
    }

    return NextResponse.json({
      message: "Login successful",
      user,
    });
  } catch (error: any) {
    const status = error.response?.status || 500;
    const data = error.response?.data || {};
    const message =
      data.message ||
      error.message ||
      "Login failed. Please try again.";

    // Pass through the unverified-account signal so the client can route the
    // user to the OTP page instead of dead-ending on a toast.
    return NextResponse.json(
      {
        message,
        ...(data.needs_verification ? { needs_verification: true } : {}),
        ...(data.email ? { email: data.email } : {}),
      },
      { status }
    );
  }
}







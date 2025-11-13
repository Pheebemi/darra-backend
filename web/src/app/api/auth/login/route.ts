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
    const message =
      error.response?.data?.message ||
      error.message ||
      "Login failed. Please try again.";

    return NextResponse.json({ message }, { status });
  }
}







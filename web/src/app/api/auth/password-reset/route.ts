import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

/** Request a password reset link. */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }

    const response = await apiClient.post("/auth/password-reset/", { email });
    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      "Could not send the reset email. Please try again.";
    return NextResponse.json({ message }, { status });
  }
}

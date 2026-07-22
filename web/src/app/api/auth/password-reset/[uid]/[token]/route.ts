import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

type Params = { params: Promise<{ uid: string; token: string }> };

/** Check whether a reset link is still valid, before showing the form. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { uid, token } = await params;
  try {
    const response = await apiClient.get(`/auth/password-reset/${uid}/${token}/`);
    return NextResponse.json(response.data);
  } catch (error: any) {
    return NextResponse.json(
      { valid: false },
      { status: error.response?.status || 400 }
    );
  }
}

/** Set the new password. */
export async function POST(request: NextRequest, { params }: Params) {
  const { uid, token } = await params;
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ message: "Password is required" }, { status: 400 });
    }

    const response = await apiClient.post(
      `/auth/password-reset/${uid}/${token}/`,
      { password }
    );
    return NextResponse.json(response.data);
  } catch (error: any) {
    const data = error.response?.data || {};
    // Django returns either {message} or DRF field errors like
    // {password: ["too common", ...]} — surface whichever is present.
    const message =
      data.message ||
      (Array.isArray(data.password) ? data.password.join(" ") : null) ||
      "Could not reset your password. Please try again.";

    return NextResponse.json(
      { message },
      { status: error.response?.status || 500 }
    );
  }
}

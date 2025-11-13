import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, full_name, user_type, brand_name, brand_slug } = body;

    if (!email || !password || !full_name || !user_type) {
      return NextResponse.json(
        { message: "Email, password, full name, and user type are required" },
        { status: 400 }
      );
    }

    const payload: any = {
      email,
      password,
      full_name,
      user_type: user_type.toLowerCase(),
    };

    if (user_type === "SELLER") {
      if (!brand_name) {
        return NextResponse.json(
          { message: "Brand name is required for sellers" },
          { status: 400 }
        );
      }
      payload.brand_name = brand_name;
      if (brand_slug) {
        payload.brand_slug = brand_slug;
      }
    }

    const response = await apiClient.post("/auth/register/", payload);

    return NextResponse.json({
      message: response.data.message || "Registration successful. Please verify your email.",
      email: response.data.email || email,
    });
  } catch (error: any) {
    const status = error.response?.status || 500;
    let message =
      error.response?.data?.message ||
      error.message ||
      "Registration failed. Please try again.";

    // Handle validation errors
    if (error.response?.data?.errors) {
      message = error.response.data.errors.join(", ");
    } else if (error.response?.data?.details) {
      const details = error.response.data.details;
      const errorMessages = Object.values(details).flat();
      message = errorMessages.join(", ");
    }

    return NextResponse.json({ message }, { status });
  }
}







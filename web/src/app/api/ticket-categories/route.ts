import { NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

export async function GET() {
  try {
    const response = await apiClient.get("/products/ticket-categories/");

    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      error.message ||
      "Failed to fetch ticket categories";

    return NextResponse.json({ message }, { status });
  }
}




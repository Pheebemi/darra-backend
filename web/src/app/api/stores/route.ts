import { NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

export async function GET() {
  try {
    const response = await apiClient.get("/auth/stores/");
    return NextResponse.json(response.data);
  } catch (error: any) {
    return NextResponse.json({ message: "Failed to fetch stores" }, { status: error.response?.status || 500 });
  }
}

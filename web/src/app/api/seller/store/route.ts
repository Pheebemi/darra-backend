import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

const BACKEND = process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api", "") || "http://localhost:8000";

export async function GET() {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    const res = await fetch(`${BACKEND}/api/auth/profile/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ message: "Failed to fetch store" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

    const contentType = request.headers.get("content-type") || "";

    let body: BodyInit;
    let headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };

    if (contentType.includes("multipart/form-data")) {
      // Forward raw FormData for banner uploads
      body = await request.blob();
      headers["Content-Type"] = contentType;
    } else {
      const json = await request.json();
      body = JSON.stringify(json);
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${BACKEND}/api/auth/profile/`, {
      method: "PATCH",
      headers,
      body,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ message: "Failed to update store" }, { status: 500 });
  }
}

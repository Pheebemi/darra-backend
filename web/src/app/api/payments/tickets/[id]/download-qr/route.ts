import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

const BACKEND = process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api", "") || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

    const { id } = await params;
    const res = await fetch(`${BACKEND}/api/payments/tickets/${id}/download-qr/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({ message: data.message || "Download failed" }, { status: res.status });
    }

    const contentDisposition = res.headers.get("content-disposition") || `attachment; filename="ticket_${id}_qr.png"`;
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": contentDisposition,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ message: "Download failed" }, { status: 500 });
  }
}

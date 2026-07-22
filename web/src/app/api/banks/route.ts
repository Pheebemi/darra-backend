import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

const BACKEND =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api", "") ||
  "http://localhost:8000";

/**
 * Bank list for the seller payout form.
 *
 * This used to call Flutterwave directly using a LIVE secret key stored in the
 * frontend environment — a credential that can move money, deployed to a host
 * that only needed a dropdown. The call now goes through Django, which already
 * holds the key and caches the result, so the frontend needs no payment
 * credentials at all.
 */
export async function GET() {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const res = await fetch(`${BACKEND}/api/auth/banks/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { message: data?.message || "Failed to fetch banks" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Banks API Error:", error?.message || error);
    return NextResponse.json(
      { message: "Failed to fetch banks" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

export async function GET() {
  try {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json(
        { message: "Flutterwave secret key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.flutterwave.com/v3/banks/NG", {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to fetch banks (${response.status})`);
    }

    const data = await response.json();

    if (data.status !== "success") {
      throw new Error(data.message || "Failed to fetch banks from Flutterwave");
    }

    // Normalize to { name, code } shape the frontend expects
    const banks = (data.data || []).map((b: any) => ({
      name: b.name,
      code: b.code,
    }));

    return NextResponse.json(banks);
  } catch (error: any) {
    console.error("Banks API Error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to fetch banks" },
      { status: 500 }
    );
  }
}

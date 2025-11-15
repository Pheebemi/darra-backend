import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Fetch Nigerian banks from Paystack
    const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    
    if (!paystackPublicKey) {
      return NextResponse.json(
        { message: "Paystack public key not configured" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.paystack.co/bank", {
      headers: {
        Authorization: `Bearer ${paystackPublicKey}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch banks from Paystack");
    }

    const data = await response.json();
    return NextResponse.json(data.data || []);
  } catch (error: any) {
    console.error("Banks API Error:", error);
    return NextResponse.json(
      { 
        message: error.message || "Failed to fetch banks",
        error: error.message 
      },
      { status: 500 }
    );
  }
}


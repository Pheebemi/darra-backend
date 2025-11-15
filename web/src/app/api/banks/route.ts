import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Fetch Nigerian banks from Paystack
    const paystackPublicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    
    if (!paystackPublicKey) {
      console.error("Paystack public key not configured in environment variables");
      return NextResponse.json(
        { 
          message: "Paystack public key not configured",
          error: "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY environment variable is missing"
        },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.paystack.co/bank", {
      headers: {
        Authorization: `Bearer ${paystackPublicKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Paystack API Error:", {
        status: response.status,
        statusText: response.statusText,
        errorData,
      });
      throw new Error(
        errorData.message || `Failed to fetch banks from Paystack (${response.status})`
      );
    }

    const data = await response.json();
    
    if (!data.status) {
      console.error("Paystack API returned error:", data);
      throw new Error(data.message || "Failed to fetch banks from Paystack");
    }

    return NextResponse.json(data.data || []);
  } catch (error: any) {
    console.error("Banks API Error:", error);
    return NextResponse.json(
      { 
        message: error.message || "Failed to fetch banks",
        error: error.message,
        details: error.toString()
      },
      { status: 500 }
    );
  }
}


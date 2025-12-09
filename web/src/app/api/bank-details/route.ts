import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

export async function GET() {
  try {
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const response = await apiClient.get("/auth/bank-detail/", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Bank details API Error:", error);
    
    const status = error.response?.status || 500;
    const errorData = error.response?.data;
    
    let message = "Failed to fetch bank details";
    
    if (errorData) {
      if (errorData.error) {
        message = errorData.error;
      } else if (errorData.message) {
        message = errorData.message;
      }
    }

    return NextResponse.json(
      { 
        message,
        error: errorData || error.message,
        status 
      },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bank_code, bank_name, account_number } = body;

    if (!bank_code || !bank_name || !account_number) {
      return NextResponse.json(
        { message: "Bank code, bank name, and account number are required" },
        { status: 400 }
      );
    }

    const response = await apiClient.post(
      "/auth/bank-detail/",
      {
        bank_code,
        bank_name,
        account_number,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Save bank details API Error:", error);
    
    const status = error.response?.status || 500;
    const errorData = error.response?.data;
    
    let message = "Failed to save bank details";
    
    if (errorData) {
      if (errorData.message) {
        message = errorData.message;
      } else if (errorData.error) {
        message = errorData.error;
      }
    }

    return NextResponse.json(
      { 
        message,
        error: errorData || error.message,
        status 
      },
      { status }
    );
  }
}



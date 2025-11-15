import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const response = await apiClient.delete(`/auth/bank-detail/${id}/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Delete bank details API Error:", error);
    
    const status = error.response?.status || 500;
    const errorData = error.response?.data;
    
    let message = "Failed to delete bank account";
    
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


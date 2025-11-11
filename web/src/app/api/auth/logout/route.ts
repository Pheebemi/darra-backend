import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { apiClient } from "@/lib/api/client";
import { getAuthCookies } from "@/lib/auth/cookies";

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await getAuthCookies();
    
    // Try to call logout endpoint if we have a token
    if (accessToken) {
      try {
        await apiClient.post(
          "/auth/logout/",
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
      } catch (error) {
        // Ignore logout API errors, just clear cookies
        console.warn("Logout API call failed:", error);
      }
    }

    await clearAuthCookies();

    return NextResponse.json({ message: "Logged out successfully" });
  } catch (error: any) {
    // Even if there's an error, clear cookies
    await clearAuthCookies();
    return NextResponse.json(
      { message: "Logged out successfully" },
      { status: 200 }
    );
  }
}




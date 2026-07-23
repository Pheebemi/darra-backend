import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

/** Hand off to a human: saves the message and alerts the admins. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await apiClient.post("/support/contact/", {
      name: body.name,
      email: body.email,
      message: body.message,
      source: body.source || "contact_form",
      conversation: body.conversation || "",
    });

    return NextResponse.json(response.data, { status: 201 });
  } catch (error: any) {
    const data = error.response?.data || {};
    // DRF field errors come back as {field: ["reason"]} — surface the first.
    const fieldError = Object.values(data).find((v) => Array.isArray(v)) as
      | string[]
      | undefined;
    const message =
      data.message || fieldError?.[0] || "Could not send your message.";

    return NextResponse.json(
      { message },
      { status: error.response?.status || 500 }
    );
  }
}

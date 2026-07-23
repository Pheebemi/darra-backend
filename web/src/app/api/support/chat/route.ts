import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

/**
 * Forwards a chat turn to Django, which talks to Grok.
 *
 * The AI key lives on the Django server and is never exposed here or in the
 * browser — this route only relays.
 */
export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ message: "No messages provided" }, { status: 400 });
    }

    const response = await apiClient.post("/support/chat/", { messages });
    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      "The assistant is unavailable right now.";
    return NextResponse.json({ message }, { status });
  }
}

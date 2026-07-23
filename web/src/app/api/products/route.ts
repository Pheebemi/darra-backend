import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";

/**
 * Product list. Filtering, sorting and paging all happen on the server —
 * the client only ever holds one page, so sorting or filtering here would
 * only apply to that page rather than the whole catalogue.
 */
const FORWARDED = [
  "product_type",
  "ticket_category",
  "search",
  "ordering",
  "page",
  "page_size",
];

export async function GET(request: NextRequest) {
  try {
    const incoming = request.nextUrl.searchParams;
    const queryParams = new URLSearchParams();

    for (const key of FORWARDED) {
      const value = incoming.get(key);
      if (value) queryParams.append(key, value);
    }

    const qs = queryParams.toString();
    const response = await apiClient.get(`/products/${qs ? `?${qs}` : ""}`);

    return NextResponse.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message =
      error.response?.data?.message ||
      error.message ||
      "Failed to fetch products";

    return NextResponse.json({ message }, { status });
  }
}

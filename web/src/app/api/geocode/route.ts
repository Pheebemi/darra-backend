import { NextRequest, NextResponse } from "next/server";

/**
 * Location search-as-you-type, for the seller's event location field.
 *
 * A thin proxy in front of Nominatim (OpenStreetMap) rather than calling it
 * straight from the browser — Nominatim's usage policy requires a real
 * identifying User-Agent, which a client-side fetch can't set reliably, and
 * keeping the query params (Nigeria-only, result count) here means callers
 * don't need to know Nominatim's API shape at all.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 3) return NextResponse.json([]);

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&countrycodes=ng&addressdetails=1`,
      { headers: { "User-Agent": "Darra/1.0 (darra.com.ng)", "Accept-Language": "en" } }
    );
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch {
    // A location search failing silently (empty suggestions) is far less
    // disruptive than surfacing an error on every keystroke.
    return NextResponse.json([]);
  }
}

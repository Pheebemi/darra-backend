import { NextRequest, NextResponse } from "next/server";
import { apiClient } from "@/lib/api/client";
import { getValidAccessToken } from "@/lib/auth/get-access-token";

async function getToken() {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = await getToken();
    const res = await apiClient.get(`/products/my-products/${id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return NextResponse.json(res.data);
  } catch (error: any) {
    if (error.message === "Not authenticated")
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    return NextResponse.json(
      { message: error.response?.data?.message || "Failed to fetch product" },
      { status: error.response?.status || 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = await getToken();
    const formData = await request.formData();
    const res = await apiClient.patch(`/products/my-products/${id}/`, formData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return NextResponse.json(res.data);
  } catch (error: any) {
    if (error.message === "Not authenticated")
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    let message = error.response?.data?.message || "Failed to update product";
    if (error.response?.data?.details) {
      const msgs = Object.values(error.response.data.details).flat();
      message = (msgs as string[]).join(", ");
    }
    return NextResponse.json({ message }, { status: error.response?.status || 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = await getToken();
    await apiClient.delete(`/products/my-products/${id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return NextResponse.json({ message: "Product deleted" });
  } catch (error: any) {
    if (error.message === "Not authenticated")
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    return NextResponse.json(
      { message: error.response?.data?.message || "Failed to delete product" },
      { status: error.response?.status || 500 }
    );
  }
}

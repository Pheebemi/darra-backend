import { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDetailClient from "./product-detail-client";

const BACKEND = process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api", "") || "http://localhost:8000";

async function fetchProduct(id: string) {
  try {
    const res = await fetch(`${BACKEND}/api/products/${id}/`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProduct(id);
  if (!product) return { title: "Product Not Found" };

  const title = product.title;
  const description = product.description?.slice(0, 160) || "Browse digital products on Darra";
  const rawImage = product.cover_image_url || product.cover_image;
  const image = rawImage
    ? rawImage.startsWith("http") ? rawImage : `${BACKEND}${rawImage}`
    : null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(image && { images: [{ url: image, width: 1200, height: 630, alt: title }] }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(image && { images: [image] }),
    },
  };
}

export default async function ProductDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await fetchProduct(id);
  if (!product) notFound();
  return <ProductDetailClient product={product} />;
}

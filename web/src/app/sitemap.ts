import { MetadataRoute } from "next";

const SITE_URL = "https://darra.com.ng";
const BACKEND =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api", "") || "http://localhost:8000";

// This is a live marketplace with listings created every day, so cap the
// crawl instead of following `has_next` forever — a runaway catalogue
// shouldn't turn sitemap generation into an unbounded fetch loop.
const MAX_PAGES = 20;
const PAGE_SIZE = 100;

interface Product {
  id: number;
  slug?: string;
  created_at?: string;
}

interface Store {
  brand_slug: string;
}

interface PaginatedResponse<T> {
  results: T[];
  pagination?: { has_next: boolean };
}

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`${BACKEND}${path}?page=${page}&page_size=${PAGE_SIZE}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) break;
    const data: PaginatedResponse<T> = await res.json();
    items.push(...(data.results || []));
    if (!data.pagination?.has_next) break;
  }
  return items;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, stores] = await Promise.all([
    fetchAllPages<Product>("/api/products/").catch(() => []),
    fetchAllPages<Store>("/api/auth/stores/").catch(() => []),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/stores`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/products/${p.slug || p.id}`,
    lastModified: p.created_at ? new Date(p.created_at) : undefined,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const storeEntries: MetadataRoute.Sitemap = stores.map((s) => ({
    url: `${SITE_URL}/store/${s.brand_slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...productEntries, ...storeEntries];
}

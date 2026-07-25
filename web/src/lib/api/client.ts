import axios from "axios";
import { headers } from "next/headers";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://pheebemi.pythonanywhere.com/api";

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: false,
});

// Forward the real visitor IP to Django so per-IP rate limits apply per
// visitor instead of to this proxy's single shared IP. Signed with a shared
// secret so the backend only trusts it from us (see RealClientIPMiddleware).
// Best-effort: outside a request scope (or with no secret set) it sends
// nothing and the request proceeds unchanged.
apiClient.interceptors.request.use(async (config) => {
  const secret = process.env.PROXY_SHARED_SECRET;
  if (!secret) return config;

  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for") || h.get("x-real-ip") || "";
    const clientIp = xff.split(",")[0].trim();
    if (clientIp) {
      config.headers.set("X-Client-IP", clientIp);
      config.headers.set("X-Proxy-Secret", secret);
    }
  } catch {
    // Not in a request context — nothing to forward.
  }

  return config;
});

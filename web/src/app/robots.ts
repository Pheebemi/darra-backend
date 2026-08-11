import { MetadataRoute } from "next";

const SITE_URL = "https://darra.com.ng";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard/",
        "/account/",
        "/cart",
        "/payment/",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password/",
        "/verify-otp",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

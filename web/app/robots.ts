import type { MetadataRoute } from "next";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://getdalil.app";
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/expert", "/login"] }], sitemap: `${SITE}/sitemap.xml`, host: SITE };
}

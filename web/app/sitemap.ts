import type { MetadataRoute } from "next";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://getdalil.app";
export default function sitemap(): MetadataRoute.Sitemap {
  return [["", 1], ["/about", 0.8], ["/zakat", 0.8], ["/experts", 0.5], ["/upgrade", 0.5], ["/attribution", 0.3], ["/privacy", 0.2], ["/terms", 0.2], ["/refund", 0.2]]
    .map(([p, priority]) => ({ url: SITE + p, lastModified: new Date(), priority: priority as number }));
}

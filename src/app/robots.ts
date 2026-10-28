import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/agent", "/admin", "/staff", "/setup", "/enrollment", "/enroll", "/plans", "/property/"] }],
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}

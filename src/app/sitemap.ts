import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.appUrl;
  const now = new Date();
  const staticPaths = [
    "",
    "/internet/cheap-internet-plans",
    "/internet/fiber",
    "/internet/apartments",
    "/internet/speed-guide",
    "/legal/privacy",
    "/legal/terms",
    "/legal/disclosures",
  ];
  const entries: MetadataRoute.Sitemap = staticPaths.map((p) => ({ url: `${base}${p}`, lastModified: now, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }));
  try {
    const [providers, zips] = await Promise.all([
      prisma.provider.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
      // Only ZIPs with configured advertised coverage get pages.
      prisma.serviceArea.findMany({ where: { provider: { active: true } }, distinct: ["zip"], select: { zip: true }, take: 45_000 }),
    ]);
    for (const p of providers) entries.push({ url: `${base}/providers/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly", priority: 0.8 });
    for (const z of zips) entries.push({ url: `${base}/internet/zip/${z.zip}`, changeFrequency: "monthly", priority: 0.5 });
  } catch (e) {
    console.error("sitemap: database unavailable", e);
  }
  return entries;
}

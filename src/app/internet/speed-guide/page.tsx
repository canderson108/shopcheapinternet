import type { Metadata } from "next";
import { ContentPage } from "@/components/ContentPage";

export const metadata: Metadata = {
  title: "Internet Speed Comparison — How Much Speed Do I Need?",
  description: "A plain-English guide to internet speeds: what Mbps means, upload vs. download, and how much speed your household needs.",
  alternates: { canonical: "/internet/speed-guide" },
};

const ACTIVITIES = [
  ["Email, browsing, social media", "1–5 Mbps", "Minimal"],
  ["HD video streaming (per stream)", "5–8 Mbps", "Minimal"],
  ["4K video streaming (per stream)", "15–25 Mbps", "Minimal"],
  ["HD video call (per person)", "3–4 Mbps", "3–4 Mbps"],
  ["Online gaming", "3–25 Mbps (latency matters more)", "1–5 Mbps"],
  ["Large game / file downloads", "As fast as possible", "—"],
  ["Uploading video, cloud backup", "—", "As fast as possible"],
];

export default function SpeedGuidePage() {
  return (
    <ContentPage
      eyebrow="Speed guide"
      title="Internet Speed Comparison: How Much Do You Need?"
      intro="Pick the right speed for your household so you don't overpay — or end up with buffering."
      breadcrumbs={[{ name: "Internet Speed Guide", href: "/internet/speed-guide" }]}
      jsonLd={{ "@context": "https://schema.org", "@type": "Article", headline: "Internet Speed Comparison: How Much Do You Need?", publisher: { "@type": "Organization", name: "Shop Cheap Internet" } }}
    >
      <h2>Download vs. upload speed</h2>
      <p>
        <strong>Download speed</strong> is how fast data reaches you — streaming, browsing, downloading. <strong>Upload speed</strong> is how fast you send data —
        video calls, posting videos, cloud backups. Fiber plans usually have equal upload and download speeds; cable and 5G plans typically have much slower uploads.
      </p>
      <h2>Speed needed by activity</h2>
      <div className="not-prose my-6 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="table-base min-w-[520px]">
          <thead><tr><th>Activity</th><th>Download</th><th>Upload</th></tr></thead>
          <tbody>
            {ACTIVITIES.map(([a, d, u]) => (
              <tr key={a}><td className="font-medium">{a}</td><td>{d}</td><td>{u}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Recommended speeds by household</h2>
      <ul>
        <li><strong>1–2 people, light use:</strong> 100–300 Mbps</li>
        <li><strong>2–4 people, streaming and video calls:</strong> 300–500 Mbps</li>
        <li><strong>4+ people, 4K, gaming, working from home:</strong> 500 Mbps–1 Gig</li>
        <li><strong>Creators and power users:</strong> 1 Gig or multi-gig with fast uploads</li>
      </ul>
      <h2>Why your Wi-Fi may be slower than your plan</h2>
      <p>
        Advertised speeds are measured over a wired connection. Over Wi-Fi, speed depends on your router, distance, walls, and device. For the best results,
        place your router centrally, use a mesh system in larger homes, and connect gaming consoles or desktops by Ethernet.
      </p>
    </ContentPage>
  );
}

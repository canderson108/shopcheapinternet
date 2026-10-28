import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@/components/Analytics";
import { env } from "@/lib/env";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", weight: ["600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: "Shop Cheap Internet — Compare Internet Plans at Your Address",
    template: "%s | Shop Cheap Internet",
  },
  description:
    "Compare internet speeds, pricing, and available offers at your address. Choose your plan and let our enrollment specialists handle the setup.",
  applicationName: "Shop Cheap Internet",
  openGraph: {
    type: "website",
    siteName: "Shop Cheap Internet",
    title: "Find Cheap Internet Plans at Your Address",
    description: "Compare internet speeds, pricing, and offers. Our enrollment specialists handle the setup.",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0b1b3f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="min-h-screen font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

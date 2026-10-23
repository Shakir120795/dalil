import "./globals.css";
import type { Metadata, Viewport } from "next";
import BottomNav from "@/modules/nav/BottomNav";
import UiLangInit from "@/modules/i18n/UiLangInit";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://getdalil.app";
const TITLE = "Dalil: Quran and Hadith answers, with sources";
const DESC = "Ask a question and get Quran and Sahih Hadith sources with exact references. Prayer times, Qibla and Ramadan mode included. Dalil shares sources, not fatwas.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: "%s | Dalil" },
  description: DESC,
  applicationName: "Dalil",
  keywords: ["Dalil", "Quran search", "Hadith search", "Islamic Q&A", "Islamic questions", "namaz time", "Qibla", "Islamic app", "Sahih Bukhari", "Sahih Muslim"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: SITE, siteName: "Dalil", title: TITLE, description: DESC, locale: "en_IN" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
  manifest: "/manifest.json",
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { themeColor: "#0c1626", width: "device-width", initialScale: 1 };

const jsonLd = {
  "@context": "https://schema.org", "@type": "WebApplication", name: "Dalil", url: SITE,
  description: DESC, applicationCategory: "ReferenceApplication", operatingSystem: "Web, Android",
  inLanguage: ["en", "hi", "ur"], offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Hanken+Grotesk:wght@400;600&family=Cormorant+Garamond:wght@500;600&display=swap" rel="stylesheet" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body><UiLangInit />{children}<BottomNav /></body>
    </html>
  );
}

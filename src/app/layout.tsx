import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteHeaderAuth } from "@/components/site-header-auth";
import { SiteChrome } from "@/components/site-chrome";
import { Preloader } from "@/components/motion/preloader";
import { SmoothScrollProvider } from "@/components/motion/smooth-scroll-provider";
import { siteConfig } from "@/lib/site-config";

import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  icons: {
    icon: [
      { url: "/brand/favicon.ico", sizes: "32x32 16x16" },
      { url: "/brand/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/brand/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/brand/apple-icon-180.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: siteConfig.url,
    images: [{ url: "/brand/og-image.png", width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: ["/brand/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-scroll-behavior is required in Next 16 for smooth scroll to be
    // honoured without breaking the router's scroll restoration.
    <html lang="en" data-scroll-behavior="smooth" className={`${anton.variable} ${inter.variable}`}>
      <head>
        {/*
          The reveal classes are server-rendered with opacity:0 so there is no
          flash of un-animated content. Without this, a visitor with JS disabled
          (or if the bundle fails to load) would get a permanently blank page,
          since nothing would ever add `is-visible`. Neutralising them in
          <noscript> keeps the no-JS render fully readable.
        */}
        <noscript>
          <style>{`.js-reveal,.js-split-unit{opacity:1!important;transform:none!important;transition:none!important}`}</style>
        </noscript>
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-sm focus:bg-blood focus:px-4 focus:py-2 focus:text-bone"
        >
          Skip to content
        </a>
        <SiteChrome>
          <Preloader />
        </SiteChrome>
        <SmoothScrollProvider>
          <div className="flex min-h-dvh flex-col">
            <SiteChrome>
              <SiteHeader authSlot={<SiteHeaderAuth />} />
            </SiteChrome>
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteChrome>
              <SiteFooter />
            </SiteChrome>
          </div>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}

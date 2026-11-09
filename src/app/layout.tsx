import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { SITE_URL } from "@/lib/env";
import Providers from "./providers";
import "@/theme/global.css";

/**
 * Self-hosted by next/font instead of the old `@import` inside global.css and the `<link>` in
 * index.html. Both were render-blocking requests to fonts.googleapis.com; this inlines the font
 * with the build and removes the layout shift. Space Grotesk was loaded by index.html but never
 * referenced by any stylesheet, so it is simply gone.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--vx-font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:
      "Voxlae — Grow as a Creator, Get Hired as a Freelancer, Find Talent as a Brand",
    template: "%s · Voxlae",
  },
  description:
    "Voxlae is the platform where creators grow, freelancers get hired, and brands find the right people. Analyze, optimize and scale your presence.",
  authors: [{ name: "Voxlae" }],
  alternates: { canonical: "/" },

  openGraph: {
    type: "website",
    siteName: "Voxlae",
    url: "/",
    title:
      "Voxlae — Grow as a Creator, Get Hired as a Freelancer, Find Talent as a Brand",
    description:
      "The platform where creators grow, freelancers get hired, and brands find the right people.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Voxlae — grow, get hired, find talent",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Voxlae — Grow as a Creator, Get Hired as a Freelancer, Find Talent as a Brand",
    description:
      "The platform where creators grow, freelancers get hired, and brands find the right people.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#FF6B2C",
  width: "device-width",
  initialScale: 1,
};

/**
 * Applies the saved light/dark preference to <html> before first paint, so there is no flash of
 * the wrong theme. Must stay in sync with src/context/ThemeContext.tsx (key "vx-theme",
 * attribute data-theme). Inline and synchronous on purpose — deferring it reintroduces the flash.
 */
const THEME_PREPAINT = `(function(){try{var p=localStorage.getItem('vx-theme');var d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;var r=(p==='dark'||p==='light')?p:(d?'dark':'light');var e=document.documentElement;e.setAttribute('data-theme',r);e.style.colorScheme=r;}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_PREPAINT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        {/* Google Identity Services — used by the sign-in button in AuthModal. */}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}

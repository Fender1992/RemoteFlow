import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://jobiq.app";

export const metadata: Metadata = {
  title: {
    default: "JobIQ - Know Before You Apply",
    template: "%s | JobIQ",
  },
  description:
    "Find quality remote jobs from 5+ sources with AI-powered ghost job detection, company credibility scores, and application tracking. Know before you apply.",
  metadataBase: new URL(appUrl),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: appUrl,
    siteName: "JobIQ",
    title: "JobIQ - Know Before You Apply",
    description:
      "Find quality remote jobs with AI-powered ghost job detection and company credibility scoring.",
  },
  twitter: {
    card: "summary_large_image",
    title: "JobIQ - Know Before You Apply",
    description:
      "Find quality remote jobs with AI-powered ghost job detection and company credibility scoring.",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: appUrl,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}

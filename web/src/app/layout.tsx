import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ProgressProvider } from "@/lib/progress-context";
import { ThemeProvider } from "@/components/ThemeProvider";
import UmamiAnalytics from "@/components/analytics/UmamiAnalytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://learning.h3nok.dev"),
  title: "Learn AI by Building It",
  description: "The only way to truly understand AI is to build it.",
  openGraph: {
    title: "Learn AI by Building It",
    description: "The only way to truly understand AI is to build it.",
    siteName: "Learn AI by Building It",
    type: "website",
    url: "https://learning.h3nok.dev",
  },
  twitter: {
    card: "summary",
    title: "Learn AI by Building It",
    description: "The only way to truly understand AI is to build it.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090B" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <head>
        {/* Preconnect to CDNs for faster resource loading */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-secondary`}
      >
        <ThemeProvider>
          <ProgressProvider>{children}</ProgressProvider>
        </ThemeProvider>
        <UmamiAnalytics />
      </body>
    </html>
  );
}

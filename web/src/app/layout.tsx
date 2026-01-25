import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ProgressProvider } from "@/lib/progress-context";
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
  themeColor: "#09090B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="dark"
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      <head>
        {/* Preconnect to CDNs for faster resource loading */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        {/* Force dark mode - prevent any light mode flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.documentElement.classList.add('dark');
              document.documentElement.style.colorScheme = 'dark';
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-secondary`}
      >
        <ProgressProvider>{children}</ProgressProvider>
        <UmamiAnalytics />
      </body>
    </html>
  );
}

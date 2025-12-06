import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ProgressProvider } from "@/lib/progress-context";
import { MonacoPreloader } from "@/components/MonacoPreloader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Learn AI by Building It",
  description: "The only way to truly understand AI is to build it.",
  openGraph: {
    title: "Learn AI by Building It",
    description: "The only way to truly understand AI is to build it.",
    siteName: "Learn AI by Building It",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
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
        <MonacoPreloader />
        <ProgressProvider>{children}</ProgressProvider>
      </body>
    </html>
  );
}


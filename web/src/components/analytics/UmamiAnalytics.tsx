'use client';

import Script from 'next/script';

export default function UmamiAnalytics() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const scriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;
  const domains = process.env.NEXT_PUBLIC_UMAMI_DOMAINS;
  const hostUrl = process.env.NEXT_PUBLIC_UMAMI_HOST_URL;
  const autoTrack = process.env.NEXT_PUBLIC_UMAMI_AUTO_TRACK;
  const allowDev = process.env.NEXT_PUBLIC_UMAMI_ALLOW_DEV === 'true';
  const isProd = process.env.NODE_ENV === 'production';

  if (!websiteId || !scriptUrl) return null;
  if (!isProd && !allowDev) return null;

  return (
    <Script
      src={scriptUrl}
      data-website-id={websiteId}
      data-domains={domains}
      data-host-url={hostUrl}
      data-auto-track={autoTrack}
      strategy="afterInteractive"
    />
  );
}

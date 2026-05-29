import type { Metadata, Viewport } from "next";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const APP_NAME = "FyneStudy";
const APP_DESCRIPTION =
  "FyneStudy — students and teachers of the institute, on every device.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: APP_NAME,
  title: {
    default: `${APP_NAME} · Coaching OS`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} · Coaching OS`,
    description: APP_DESCRIPTION,
    images: [{ url: "/og.png", width: 1024, height: 500, alt: APP_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} · Coaching OS`,
    description: APP_DESCRIPTION,
    images: ["/og.png"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  icons: {
    icon: "/icons/icon-192.png",
    shortcut: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
  // No maximumScale / userScalable:false — blocking pinch-zoom fails WCAG 1.4.4
  // (Resize Text). The native app's zoom-lock doesn't transfer to a web PWA.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
      </head>
      <body className="bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}

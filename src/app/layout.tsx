import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionToolbar from "./session-toolbar";
import RydahSplash from "./rydah-splash";
import PwaRegister from "./pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rydahlocal.online"),
  title: {
    default: "Rydah Local | Local Services Marketplace Preparing for Launch",
    template: "%s | Rydah Local",
  },
  description: "Explore Rydah Local's planned local-services marketplace. Provider availability depends on completed verification and onboarding. Lagos, Abuja, Ibadan, Warri and Port Harcourt are planned markets.",
  applicationName: "Rydah Local",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/rydah-icon.svg", type: "image/svg+xml" }],
    shortcut: ["/rydah-icon.svg"],
    apple: [{ url: "/rydah-icon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    title: "Rydah Local",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://rydahlocal.online",
    siteName: "Rydah Local",
    title: "Rydah Local | Move Smart. Move Rydah.",
    description: "Rydah Local is preparing a marketplace for local services in Nigeria. Booking availability depends on verified providers being online.",
    images: [{ url: "/rydah-icon.svg", alt: "Rydah Local" }],
  },
  twitter: {
    card: "summary",
    title: "Rydah Local",
    description: "Move Smart. Move Rydah. Preparing local services for planned Nigerian markets; verified provider availability may vary.",
    images: ["/rydah-icon.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#080808",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        <RydahSplash />
        {children}
        <SessionToolbar />
      </body>
    </html>
  );
}

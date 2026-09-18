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
    default: "Rydah Local | Trusted Local Professionals in Lagos, Abuja & Ibadan",
    template: "%s | Rydah Local",
  },
  description: "Book trusted local professionals, review quotes, verify provider arrival and manage secure Rydah jobs across Lagos, Abuja and Ibadan.",
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
    description: "Trusted local professionals, real work and safer service bookings across Lagos, Abuja and Ibadan.",
    images: [{ url: "/rydah-icon.svg", alt: "Rydah Local" }],
  },
  twitter: {
    card: "summary",
    title: "Rydah Local",
    description: "Move Smart. Move Rydah. Trusted local professionals across Lagos, Abuja and Ibadan.",
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
      <body className="min-h-full flex flex-col pb-24 md:pb-28">
        <PwaRegister />
        <RydahSplash />
        {children}
        <SessionToolbar />
      </body>
    </html>
  );
}

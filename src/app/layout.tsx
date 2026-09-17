import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionToolbar from "./session-toolbar";
import RydahSplash from "./rydah-splash";

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
    default: "Rydah Local | Trusted Local Professionals in Lagos",
    template: "%s | Rydah Local",
  },
  description: "Find verified local professionals for trusted home and local services across Lagos.",
  applicationName: "Rydah Local",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://rydahlocal.online",
    siteName: "Rydah Local",
    title: "Rydah Local | Trusted Local Professionals in Lagos",
    description: "Find verified local professionals for trusted home and local services across Lagos.",
  },
  twitter: {
    card: "summary",
    title: "Rydah Local",
    description: "Find verified local professionals across Lagos.",
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
        <RydahSplash />
        {children}
        <SessionToolbar />
      </body>
    </html>
  );
}

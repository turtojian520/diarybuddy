import type { Metadata, Viewport } from "next";
import { Noto_Serif_SC } from "next/font/google";
import { TopNav } from "@/components/TopNav";
import { PWARegister } from "@/components/PWARegister";
import "./globals.css";

const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-noto-serif-sc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DiaryBuddy — Your AI Soul Companion",
  description: "Capture fragments, then shape them into a finished entry.",
  manifest: "/manifest.json",
  applicationName: "Diarybuddy",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Diarybuddy",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFBF7" },
    { media: "(prefers-color-scheme: dark)", color: "#16130f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className={notoSerifSC.variable}>
      <body>
        <TopNav />
        {children}
        <PWARegister />
      </body>
    </html>
  );
}

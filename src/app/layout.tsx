import type { Metadata } from "next";
import { Noto_Serif_SC } from "next/font/google";
import { TopNav } from "@/components/TopNav";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className={`h-full ${notoSerifSC.variable}`}>
      <body className="min-h-full">
        <TopNav />
        {children}
      </body>
    </html>
  );
}

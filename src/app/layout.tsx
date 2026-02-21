import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const thaiFont = IBM_Plex_Sans_Thai({
  weight: ['400', '600', '700'],
  subsets: ["thai"],
  variable: "--font-thai"
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Fall Guard AI - ระบบเฝ้าระวังอัจฉริยะ",
  description: "ระบบตรวจจับการล้มด้วย AI และแจ้งเตือนแบบ Real-time",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={thaiFont.variable}>
      <body className="font-thai antialiased bg-[#020617] text-slate-100">
        {children}
      </body>
    </html>
  );
}

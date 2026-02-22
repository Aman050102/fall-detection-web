import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const thaiFont = IBM_Plex_Sans_Thai({
  weight: ['400', '500', '600', '700'],
  subsets: ["thai"],
  variable: "--font-thai"
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#020617",
};

export const metadata: Metadata = {
  title: "Guard Vision | AI Fall Detection",
  description: "ระบบตรวจจับการหกล้มอัจฉริยะและแจ้งเตือนเรียลไทม์",
  icons: {
    // ระบุแบบเจาะจงเพื่อแก้ปัญหาโลโก้ไม่ขึ้น
    icon: [
      { url: "/logo.png", type: "image/png" }
    ],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${thaiFont.variable} scroll-smooth`}>
      <body className="font-thai antialiased bg-[#020617] text-slate-100 min-h-screen selection:bg-blue-500/30">
        <div className="relative flex flex-col min-h-screen">
          {children}
        </div>
        <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full"></div>
          <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-red-900/10 blur-[120px] rounded-full"></div>
        </div>
      </body>
    </html>
  );
}

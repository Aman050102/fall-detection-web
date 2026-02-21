import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const thaiFont = IBM_Plex_Sans_Thai({
  weight: ['400', '600', '700'],
  subsets: ["thai"],
  variable: "--font-thai"
});

export const metadata: Metadata = {
  title: "Fall Guard AI - ระบบตรวจจับการล้มอัจฉริยะ",
  description: "ตรวจจับและแจ้งเตือนเหตุฉุกเฉินสำหรับผู้สูงอายุด้วยเทคโนโลยี AI Real-time",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${inter.variable} ${thaiFont.variable}`}>
      <body className="font-thai antialiased">
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
        {/* คุณสามารถใส่ Notification Component แบบ Global ไว้ที่นี่ได้ */}
      </body>
    </html>
  );
}

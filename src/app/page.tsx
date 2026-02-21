"use client";
import Link from 'next/link';
import { Camera, Monitor } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white">
      <h1 className="text-3xl font-black mb-10 tracking-tighter uppercase italic">
        Fall Guard <span className="text-blue-500">System</span>
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        <Link href="/camera" className="group bg-zinc-900 border border-zinc-800 p-8 rounded-3xl hover:border-blue-500 transition-all">
          <Camera size={48} className="text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
          <h2 className="text-xl font-bold">CCTV MODE</h2>
          <p className="text-zinc-500 text-sm mt-2">เปิดกล้องเพื่อตรวจจับการล้ม (วางทิ้งไว้ในห้อง)</p>
        </Link>

        <Link href="/monitor" className="group bg-zinc-900 border border-zinc-800 p-8 rounded-3xl hover:border-red-500 transition-all">
          <Monitor size={48} className="text-red-500 mb-4 group-hover:scale-110 transition-transform" />
          <h2 className="text-xl font-bold">MONITOR MODE</h2>
          <p className="text-zinc-500 text-sm mt-2">หน้าจอแจ้งเตือนสำหรับผู้ดูแล (พกติดตัว)</p>
        </Link>
      </div>
    </div>
  );
}

"use client";
import Link from 'next/link';
import { Camera, ShieldAlert, Activity } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="text-center mb-12 animate-in">
        <div className="inline-block p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-4">
          <ShieldAlert className="text-blue-500" size={32} />
        </div>
        <h1 className="text-4xl font-black tracking-tighter uppercase italic">
          FALL GUARD <span className="text-blue-500">AI</span>
        </h1>
        <p className="text-zinc-500 text-sm mt-2 tracking-widest uppercase font-bold">
          Smart Surveillance System
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        {/* ปุ่มไปหน้ากล้อง */}
        <Link href="/camera" className="group relative bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] overflow-hidden hover:border-blue-500 transition-all duration-500">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Camera size={80} />
          </div>
          <Camera size={40} className="text-blue-500 mb-6" />
          <h2 className="text-2xl font-bold mb-2 uppercase tracking-tight">CCTV Mode</h2>
          <p className="text-zinc-500 text-sm leading-relaxed">
            เปลี่ยนเครื่องนี้ให้เป็นกล้องตรวจจับอัจฉริยะ วางทิ้งไว้เพื่อเฝ้าระวังการล้ม
          </p>
        </Link>

        {/* ปุ่มไปหน้ามอนิเตอร์ */}
        <Link href="/monitor" className="group relative bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] overflow-hidden hover:border-red-500 transition-all duration-500">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <ShieldAlert size={80} />
          </div>
          <Activity size={40} className="text-red-500 mb-6" />
          <h2 className="text-2xl font-bold mb-2 uppercase tracking-tight">Monitor Mode</h2>
          <p className="text-zinc-500 text-sm leading-relaxed">
            หน้าจอสำหรับผู้ดูแล รับการแจ้งเตือนและสั่นเตือนเมื่อเกิดเหตุฉุกเฉิน
          </p>
        </Link>
      </div>

      <footer className="mt-16 text-zinc-700 text-[10px] uppercase tracking-[0.4em] font-bold">
        Connected via Firebase Realtime Database
      </footer>
    </div>
  );
}

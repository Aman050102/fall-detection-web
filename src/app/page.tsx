"use client";
import React from 'react';
import Link from 'next/link';
import { Camera, ShieldAlert, Activity, ChevronRight } from 'lucide-react';
import { useEmergency } from '@/hooks/useEmergency';

export default function LandingPage() {
  const { requestPermission } = useEmergency();

  // ฟังก์ชันปลดล็อกสิทธิ์ระบบก่อนเข้าสู่หน้าใช้งานจริง
  const handleStart = async () => {
    try {
      // 1. ขอสิทธิ์แจ้งเตือน (Notification)
      await requestPermission();

      // 2. ปลดล็อก Audio Context ของเบราว์เซอร์
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      console.log("System Initialized: Permissions Secured");
    } catch (err) {
      console.warn("Permission handling skipped or denied:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-white font-sans relative overflow-hidden">

      {/* Background Effect ตกแต่ง */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-600/5 blur-[120px] rounded-full"></div>

      <div className="text-center mb-16 z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="inline-flex p-4 rounded-3xl bg-blue-500/10 border border-blue-500/20 mb-6 shadow-2xl shadow-blue-500/20">
          <ShieldAlert className="text-blue-500" size={40} />
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase italic leading-none">
          GUARD <span className="text-blue-500">VISION</span>
        </h1>
        <p className="text-zinc-500 text-[10px] md:text-xs mt-4 tracking-[0.5em] uppercase font-black opacity-70">
          Next-Gen AI Fall Detection Protocol
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl z-10">

        {/* --- CCTV MODE CARD --- */}
        <Link
          href="/camera"
          onClick={handleStart}
          className="group relative bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-10 rounded-[3rem] overflow-hidden hover:border-blue-500/50 hover:bg-zinc-800/50 transition-all duration-500 shadow-2xl"
        >
          <div className="absolute -top-4 -right-4 p-8 opacity-[0.03] group-hover:opacity-10 group-hover:scale-110 transition-all duration-700">
            <Camera size={160} />
          </div>

          <div className="relative z-10">
            <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-8 border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white transition-colors">
              <Camera size={28} />
            </div>
            <h2 className="text-3xl font-black mb-3 uppercase italic tracking-tighter">CCTV Mode</h2>
            <p className="text-zinc-400 text-sm leading-relaxed font-medium">
              เปิดใช้งานกล้อง Edge AI สำหรับเฝ้าระวังการล้มในพื้นที่ ประมวลผลบนเครื่อง 100% เพื่อความเป็นส่วนตัว
            </p>
            <div className="mt-8 flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">
              Initialize Node <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>

        {/* --- MONITOR MODE CARD --- */}
        <Link
          href="/monitor"
          onClick={handleStart}
          className="group relative bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-10 rounded-[3rem] overflow-hidden hover:border-red-500/50 hover:bg-zinc-800/50 transition-all duration-500 shadow-2xl"
        >
          <div className="absolute -top-4 -right-4 p-8 opacity-[0.03] group-hover:opacity-10 group-hover:scale-110 transition-all duration-700">
            <ShieldAlert size={160} />
          </div>

          <div className="relative z-10">
            <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mb-8 border border-red-500/20 group-hover:bg-red-500 group-hover:text-white transition-colors">
              <Activity size={28} />
            </div>
            <h2 className="text-3xl font-black mb-3 uppercase italic tracking-tighter">Command Unit</h2>
            <p className="text-zinc-400 text-sm leading-relaxed font-medium">
              ศูนย์ควบคุมหลัก รับการแจ้งเตือนพุช สั่น และไซเรนแบบเรียลไทม์ พร้อมบันทึกภาพหลักฐานเหตุการณ์
            </p>
            <div className="mt-8 flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">
              Access Control <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>
      </div>

      <footer className="mt-20 flex flex-col items-center gap-4 z-10">
        <div className="flex items-center gap-4 px-6 py-2 bg-white/5 rounded-full border border-white/5 backdrop-blur-md">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em]">Network: Firebase Realtime Database Secured</span>
        </div>
      </footer>
    </div>
  );
}

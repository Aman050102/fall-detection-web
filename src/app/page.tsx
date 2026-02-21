"use client";
import React, { useState } from 'react';
import { Camera, AlertTriangle, ShieldCheck, MonitorPlay, Settings } from 'lucide-react';
import Link from 'next/link';
import FallDetector from '@/components/FallDetector'; // แยก Logic AI ออกไป

export default function Dashboard() {
  const [activeAlert, setActiveAlert] = useState(false);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans">
      {/* Navigation Bar */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <ShieldCheck size={24} className="text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">FALL GUARD <span className="text-blue-500">AI</span></span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/monitor" className="flex items-center gap-2 text-sm font-medium hover:text-blue-400 transition-colors">
              <MonitorPlay size={18} /> ดูกล้อง CCTV
            </Link>
            <Settings size={20} className="text-slate-400 cursor-pointer hover:rotate-90 transition-transform duration-500" />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: AI Camera Content */}
        <div className="lg:col-span-8 space-y-6">
          <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border-2 border-slate-800 shadow-[0_0_50px_-12px_rgba(59,130,246,0.3)]">
            <FallDetector onFallDetected={() => setActiveAlert(true)} />

            {activeAlert && (
              <div className="absolute inset-0 z-50 bg-red-600/20 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-300">
                <div className="bg-red-600 text-white p-8 rounded-full animate-bounce shadow-[0_0_40px_#dc2626]">
                  <AlertTriangle size={48} />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="สถานะระบบ" value="ออนไลน์" color="text-green-400" />
            <StatCard label="ความแม่นยำ AI" value="81.7%" color="text-blue-400" />
            <StatCard label="FPS" value="24" color="text-yellow-400" />
            <StatCard label="การแจ้งเตือนวันนี้" value="2 ครั้ง" color="text-red-400" />
          </div>
        </div>

        {/* Right Column: Controls & Logs */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
              ศูนย์ควบคุมการแจ้งเตือน
            </h3>
            <button className="w-full mb-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2">
              <Camera size={20} /> สลับกล้อง (หน้า/หลัง)
            </button>
            <p className="text-xs text-slate-500 text-center">ระบบจะสั่นเครื่องอัตโนมัติเมื่อตรวจพบเหตุ</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 h-[400px] flex flex-col shadow-xl">
            <h3 className="text-lg font-bold mb-4">บันทึกเหตุการณ์</h3>
            <div className="flex-grow overflow-y-auto space-y-3 pr-2">
              <LogItem time="14:05" type="Falling" status="แจ้งเตือนแล้ว" />
              <LogItem time="12:30" type="Standing" status="ปกติ" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Sub-components เพื่อความสะอาดของโค้ด
const StatCard = ({ label, value, color }: any) => (
  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">{label}</p>
    <p className={`text-xl font-black ${color}`}>{value}</p>
  </div>
);

const LogItem = ({ time, type, status }: any) => (
  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-sm">
    <span className="text-slate-500 font-mono">{time}</span>
    <span className="font-bold">{type}</span>
    <span className={type === 'Falling' ? 'text-red-500' : 'text-slate-400'}>{status}</span>
  </div>
);

"use client";
import React, { useState, useEffect } from 'react';
import { Camera, AlertTriangle, ShieldCheck, MonitorPlay, Settings, BellRing } from 'lucide-react';
import Link from 'next/link';
import FallDetector from '@/components/FallDetector';
import { useEmergency } from '@/hooks/useEmergency';

export default function Dashboard() {
  const [activeAlert, setActiveAlert] = useState(false);
  const { triggerAlarm, requestPermission } = useEmergency();

  useEffect(() => {
    requestPermission(); // ขอสิทธิ์แจ้งเตือนเมื่อเข้าหน้าเว็บ
  }, []);

  const handleFallDetected = () => {
    if (!activeAlert) {
      setActiveAlert(true);
      triggerAlarm("ตรวจพบคนล้มในห้องนั่งเล่น! กรุณาตรวจสอบด่วน");

      // ปิดสถานะแจ้งเตือนหน้าจอหลังจาก 5 วินาที
      setTimeout(() => setActiveAlert(false), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-blue-500/30">
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-900/20">
              <ShieldCheck size={24} className="text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight uppercase">FallGuard <span className="text-blue-500">Pro</span></span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/monitor" className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
              <MonitorPlay size={18} /> ระบบ CCTV
            </Link>
            <button onClick={requestPermission} className="text-slate-400 hover:text-blue-400 transition-colors">
              <BellRing size={20} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="relative aspect-video bg-black rounded-[2rem] overflow-hidden border-2 border-slate-800 shadow-2xl group">
            <FallDetector onFallDetected={handleFallDetected} />

            {activeAlert && (
              <div className="absolute inset-0 z-50 bg-red-600/20 backdrop-blur-sm flex items-center justify-center animate-in fade-in zoom-in duration-300">
                <div className="bg-red-600 text-white p-10 rounded-full animate-ping absolute opacity-20"></div>
                <div className="bg-red-600 text-white p-8 rounded-full shadow-[0_0_60px_#dc2626] relative z-10">
                  <AlertTriangle size={64} className="animate-bounce" />
                </div>
                <h2 className="absolute bottom-20 text-3xl font-black tracking-tighter text-white drop-shadow-lg">EMERGENCY DETECTED</h2>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="System Status" value="Active" color="text-green-400" />
            <StatCard label="AI Accuracy" value="81.7%" color="text-blue-400" />
            <StatCard label="Detection" value="Real-time" color="text-yellow-400" />
            <StatCard label="Alerts Today" value="02" color="text-red-400" />
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-xl">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
              <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
              Control Center
            </h3>
            <div className="space-y-4">
              <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-900/40 flex items-center justify-center gap-3 active:scale-95">
                <Camera size={22} /> Switch Camera
              </button>
              <button onClick={handleFallDetected} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3">
                Test Alert System
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 h-[380px] flex flex-col shadow-xl">
            <h3 className="text-xl font-bold mb-6">Activity Log</h3>
            <div className="flex-grow overflow-y-auto space-y-4 custom-scrollbar">
              <LogItem time="14:05:22" type="Fall Detected" status="Critical" danger />
              <LogItem time="13:58:10" type="Standing" status="Normal" />
              <LogItem time="12:30:45" type="Sitting" status="Normal" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const StatCard = ({ label, value, color }: any) => (
  <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black mb-1">{label}</p>
    <p className={`text-2xl font-black ${color}`}>{value}</p>
  </div>
);

const LogItem = ({ time, type, status, danger }: any) => (
  <div className={`p-4 rounded-2xl border ${danger ? 'bg-red-500/10 border-red-500/20' : 'bg-slate-950 border-slate-800'} flex justify-between items-center transition-all`}>
    <div className="flex flex-col">
      <span className="text-[10px] font-mono text-slate-500 mb-1">{time}</span>
      <span className={`font-bold ${danger ? 'text-red-400' : 'text-slate-200'}`}>{type}</span>
    </div>
    <span className={`text-xs font-black px-3 py-1 rounded-full ${danger ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-400'}`}>{status}</span>
  </div>
);

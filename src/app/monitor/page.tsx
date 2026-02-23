"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { ref, onValue, set, query, limitToLast, remove } from "firebase/database";
import { useEmergency } from '@/hooks/useEmergency';
import {
  ShieldAlert, Activity, History,
  Trash2, Home
} from 'lucide-react';

// ✅ กำหนด Interface เพื่อเลี่ยงการใช้ 'any'
interface FallHistory {
  id: string;
  evidence: string;
  timestamp: number;
  timeStr: string;
}

export default function MonitorPage() {
  const [isEmergency, setIsEmergency] = useState(false);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<string | null>(null);

  // ✅ ใช้ Lazy Initializer () => Date.now() เพื่อแก้ปัญหา Impure function during render
  const [lastUpdate, setLastUpdate] = useState<number>(() => Date.now());

  const [fallTime, setFallTime] = useState<string | null>(null);
  const [history, setHistory] = useState<FallHistory[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  const { triggerAlarm, requestPermission, stopAlarm } = useEmergency();
  const prevEmergencyRef = useRef(false);

  useEffect(() => {
    requestPermission();

    // เช็คสถานะการเชื่อมต่อทุก 3 วินาที
    const timer = setInterval(() => {
      // ตรวจสอบว่าภาพล่าสุดขาดหายนานกว่า 8 วินาทีหรือไม่
      if (Date.now() - lastUpdate > 8000) {
        setIsOffline(true);
      }
    }, 3000);

    // รับภาพสดจาก Firebase
    const unsubscribeLive = onValue(ref(db, 'system/live_stream'), (s) => {
      const data = s.val();
      if (data?.frame) {
        setLiveFrame(data.frame);
        setLastUpdate(Date.now());
        setIsOffline(false);
      }
    });

    // รับสถานะเหตุฉุกเฉิน
    const unsubscribeEvent = onValue(ref(db, 'system/fall_event'), (s) => {
      const data = s.val();
      const detected = !!data?.detected;
      if (detected) {
        setIsEmergency(true);
        setEvidence(data.evidence);
        setFallTime(data.timestamp ? new Date(data.timestamp).toLocaleTimeString('th-TH') : "N/A");

        // ส่งสัญญาณเตือนเฉพาะเมื่อตรวจพบครั้งแรก
        if (!prevEmergencyRef.current) {
          triggerAlarm(`🚨 EMERGENCY: Fall detected!`);
        }
      } else {
        setIsEmergency(false);
        stopAlarm();
      }
      prevEmergencyRef.current = detected;
    });

    // ดึงประวัติ 20 รายการล่าสุด
    const historyQuery = query(ref(db, 'history/falls'), limitToLast(20));
    const unsubscribeHistory = onValue(historyQuery, (s) => {
      const data = s.val();
      if (data) {
        const historyList = Object.entries(data).map(([id, value]) => ({
          id,
          ...(value as Omit<FallHistory, 'id'>)
        })).reverse();
        setHistory(historyList);
      } else {
        setHistory([]);
      }
    });

    return () => {
      clearInterval(timer);
      unsubscribeLive();
      unsubscribeEvent();
      unsubscribeHistory();
      stopAlarm();
    };
  }, [lastUpdate, requestPermission, triggerAlarm, stopAlarm]);

  const handleReset = async () => {
    stopAlarm();
    // รีเซ็ตสถานะแจ้งเตือนใน Firebase
    await set(ref(db, 'system/fall_event'), { detected: false, evidence: null });
  };

  const handleDeleteHistory = async (id: string) => {
    if (window.confirm("ต้องการลบประวัตินี้หรือไม่?")) {
      await remove(ref(db, `history/falls/${id}`));
    }
  };

  return (
    <div className={`min-h-screen transition-all duration-700 ${isEmergency ? 'bg-red-950' : 'bg-[#050505]'} text-zinc-100 font-sans`}>
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* ✅ ปุ่มกลับหน้าหลัก (src/app/page.tsx) */}
            <Link href="/">
              <button className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-2xl border border-white/5 transition-all">
                <Home size={20} className="text-zinc-400" />
              </button>
            </Link>
            <div className={`p-2.5 rounded-2xl ${isEmergency ? 'bg-red-600 animate-pulse shadow-lg shadow-red-600/20' : 'bg-blue-600 shadow-md'}`}>
              <ShieldAlert size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-black uppercase tracking-tighter text-xl italic text-white">Monitor Hub</h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none">AI Surveillance</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black border ${isOffline ? 'border-red-500 text-red-500 bg-red-500/5' : 'border-green-500 text-green-500 bg-green-500/5'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isOffline ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
            {isOffline ? 'CAM OFFLINE' : 'CAM ONLINE'}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          {isEmergency && (
            <section className="bg-red-600 rounded-[2.5rem] p-4 flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-top-4 duration-500 shadow-2xl">
              <img src={evidence || ""} className="w-full md:w-48 aspect-square rounded-[1.5rem] object-cover border-2 border-white/20" alt="Evidence" />
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Fall Event Detected</h2>
                <p className="text-white/80 font-bold text-xs uppercase tracking-widest">Time: {fallTime}</p>
                <button onClick={handleReset} className="mt-4 bg-white text-red-600 px-8 py-3 rounded-xl font-black uppercase text-xs hover:scale-105 transition-all">Resolve Alert</button>
              </div>
            </section>
          )}

          <section className="relative aspect-video bg-zinc-900 rounded-[3rem] overflow-hidden border border-white/5 shadow-2xl">
            {liveFrame && !isOffline ? (
              <img src={liveFrame} className="w-full h-full object-cover" alt="Live Feed" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700">
                <Activity className="animate-pulse mb-4" size={48} />
                <p className="text-[10px] font-black uppercase tracking-[0.5em]">Searching for Signal</p>
              </div>
            )}
            <div className="absolute top-8 left-8 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isOffline ? 'bg-zinc-600' : 'bg-red-500 animate-pulse'}`} />
              <span className="text-[9px] font-bold uppercase text-white tracking-widest italic">Stream Active</span>
            </div>
          </section>
        </div>

        <div className="lg:col-span-4">
          <section className="bg-zinc-900/30 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6 h-full flex flex-col shadow-xl">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
              <History size={14} /> Incident Logs
            </h3>
            <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
              {history.length > 0 ? history.map((item) => (
                <div key={item.id} className="group flex items-center gap-4 p-3 bg-white/[0.03] rounded-2xl border border-white/5 hover:bg-white/[0.06] transition-all">
                  <img src={item.evidence} className="w-14 h-14 rounded-lg object-cover grayscale group-hover:grayscale-0 transition-all" alt="Fall Evidence" />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-zinc-400 italic">{item.timeStr}</p>
                    <p className="text-[8px] font-black text-blue-500/50 uppercase tracking-widest">Logged</p>
                  </div>
                  <button onClick={() => handleDeleteHistory(item.id)} className="p-2 text-zinc-600 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center opacity-10">
                  <History size={40} />
                  <p className="text-[10px] uppercase font-bold mt-2">No Records</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

    </div>
  );
}

"use client";
import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, query, limitToLast, remove } from "firebase/database";
import { useEmergency } from '@/hooks/useEmergency';
import {
  ShieldAlert, Activity, Eye, Clock, History,
  Wifi, WifiOff, PhoneCall, MessageSquare,
  RefreshCcw, AlertTriangle, TrendingUp, Trash2
} from 'lucide-react';

export default function MonitorPage() {
  const [isEmergency, setIsEmergency] = useState(false);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [fallTime, setFallTime] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  // ดึง stopAlarm มาใช้ด้วยเพื่อให้กดหยุดเสียงได้
  const { triggerAlarm, requestPermission, stopAlarm } = useEmergency();

  // ใช้เพื่อเช็คสถานะก่อนหน้า ป้องกันเสียงดังซ้ำซ้อน
  const prevEmergencyRef = useRef(false);

  useEffect(() => {
    requestPermission();

    // 1. ตรวจสอบการเชื่อมต่อและภาพสด
    const liveRef = ref(db, 'system/live_stream');
    const unsubscribeLive = onValue(liveRef, (s) => {
      const data = s.val();
      if (data?.frame) {
        setLiveFrame(data.frame);
        setLastUpdate(Date.now());
      }
    });

    // 2. ระบบแจ้งเตือนเหตุฉุกเฉิน
    const eventRef = ref(db, 'system/fall_event');
    const unsubscribeEvent = onValue(eventRef, (s) => {
      const data = s.val();
      const detected = !!data?.detected;

      if (detected) {
        setIsEmergency(true);
        setEvidence(data.evidence);
        setFallTime(data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "N/A");

        // ส่งสัญญาณเตือนเฉพาะเมื่อตรวจพบครั้งแรก (ป้องกันเสียงตีกัน)
        if (!prevEmergencyRef.current) {
          triggerAlarm(`ตรวจพบการล้มในพื้นที่เฝ้าระวังเมื่อ ${new Date().toLocaleTimeString()}`);
        }
      } else {
        setIsEmergency(false);
        stopAlarm(); // หยุดเสียงเมื่อสถานะใน DB ถูกรีเซ็ต
      }
      prevEmergencyRef.current = detected;
    });

    // 3. ประวัติการแจ้งเตือน (20 รายการล่าสุด)
    const historyRef = query(ref(db, 'history/falls'), limitToLast(20));
    const unsubscribeHistory = onValue(historyRef, (s) => {
      const data = s.val();
      if (data) {
        const historyList = Object.entries(data).map(([id, value]: [string, any]) => ({
          id,
          ...value
        })).reverse();
        setHistory(historyList);
      } else {
        setHistory([]);
      }
    });

    return () => {
      unsubscribeLive();
      unsubscribeEvent();
      unsubscribeHistory();
      stopAlarm();
    };
  }, []);

  const isCameraOffline = Date.now() - lastUpdate > 5000;

  // ฟังก์ชันยืนยันความปลอดภัย (Reset)
  const handleReset = async () => {
    // หยุดเสียงทันทีที่กดปุ่ม
    stopAlarm();

    if (evidence) {
      try {
        const newHistoryRef = push(ref(db, 'history/falls'));
        await set(newHistoryRef, {
          evidence,
          timestamp: Date.now(),
          timeStr: fallTime
        });
      } catch (err) {
        console.error("Save History Error:", err);
      }
    }

    // รีเซ็ตสถานะใน Firebase
    await set(ref(db, 'system/fall_event'), { detected: false, evidence: null });
  };

  const handleDeleteHistory = async (id: string) => {
    if (window.confirm("คุณต้องการลบภาพประวัตินี้ใช่หรือไม่?")) {
      try {
        await remove(ref(db, `history/falls/${id}`));
      } catch (error) {
        console.error("Delete Error:", error);
      }
    }
  };

  return (
    <div className={`min-h-screen transition-all duration-700 ${isEmergency ? 'bg-red-950' : 'bg-[#050505]'} text-zinc-100 font-sans selection:bg-blue-500/30`}>

      {/* --- HEADER --- */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-2xl transition-colors ${isEmergency ? 'bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.5)]' : 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.3)]'}`}>
              <ShieldAlert size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-black uppercase tracking-tighter text-xl leading-none italic">Guard Vision <span className="text-[10px] not-italic font-bold bg-zinc-800 px-2 py-0.5 rounded ml-2">MONITOR</span></h1>
              <p className="text-[10px] text-zinc-500 font-bold tracking-[0.2em] uppercase mt-1">AI Safety Protocol Active</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black border transition-all ${isCameraOffline ? 'border-red-500/50 text-red-500 bg-red-500/5' : 'border-green-500/50 text-green-500 bg-green-500/5'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isCameraOffline ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
              {isCameraOffline ? 'SIGNAL LOST' : 'LINK ESTABLISHED'}
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">System Clock</p>
              <p className="text-sm font-black italic tracking-tighter">{new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">

        <div className="lg:col-span-8 space-y-6">
          {/* --- EMERGENCY ALERT BANNER --- */}
          {isEmergency && (
            <section className="bg-red-600 rounded-[2.5rem] p-2 flex flex-col md:flex-row items-center gap-6 animate-in zoom-in-95 duration-500 shadow-[0_0_80px_rgba(220,38,38,0.4)] border border-red-400/30">
              <div className="w-full md:w-56 aspect-square rounded-[2rem] overflow-hidden border-2 border-white/20 shadow-2xl">
                <img src={evidence || ""} className="w-full h-full object-cover" alt="Fall Evidence" />
              </div>
              <div className="flex-1 text-center md:text-left py-4 px-2">
                <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white mb-3">
                  <AlertTriangle size={14} className="animate-bounce" /> High Priority Alert
                </div>
                <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-tight">Detected Fall Event</h2>
                <p className="text-white/80 font-bold text-sm mt-1 uppercase tracking-wide">Timestamp: {fallTime}</p>
              </div>
              <div className="pr-8 pb-6 md:pb-0">
                <button onClick={handleReset} className="bg-white text-red-600 px-10 py-5 rounded-[1.5rem] font-black uppercase italic tracking-tighter shadow-2xl hover:scale-105 active:scale-95 transition-all">
                  Confirm & Reset
                </button>
              </div>
            </section>
          )}

          {/* --- MAIN FEED --- */}
          <section className="relative aspect-video bg-zinc-950 rounded-[3.5rem] overflow-hidden border border-white/5 shadow-2xl group">
            {liveFrame && !isCameraOffline ? (
              <img src={liveFrame} className="w-full h-full object-cover" alt="Live Feed" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-800">
                <Activity className="animate-pulse mb-4 opacity-20" size={80} />
                <p className="text-xs font-black uppercase tracking-[0.6em] opacity-30">Reconnecting...</p>
              </div>
            )}

            <div className="absolute top-10 left-10 flex items-center gap-4">
              <div className="bg-black/40 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-white/10 flex items-center gap-3 shadow-2xl">
                <div className={`w-2 h-2 rounded-full ${isCameraOffline ? 'bg-zinc-700' : 'bg-red-500 animate-pulse'}`} />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Cam_01_Main</span>
              </div>
            </div>

            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-2xl p-4 rounded-[2.5rem] border border-white/10 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
              <button className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-[1.2rem] font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all">
                <Eye size={16} /> Focus Mode
              </button>
              <button className="p-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-[1.2rem] transition-all"><MessageSquare size={20} /></button>
              <button className="p-4 bg-red-600 hover:bg-red-500 text-white rounded-[1.2rem] transition-all shadow-lg shadow-red-600/30"><PhoneCall size={20} /></button>
            </div>
          </section>
        </div>

        {/* --- SIDEBAR --- */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-zinc-900/30 backdrop-blur-xl rounded-[3rem] border border-white/5 p-8 h-full flex flex-col min-h-[600px] shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-800/50 rounded-xl"><History size={18} className="text-blue-500" /></div>
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Event History</h3>
              </div>
              <TrendingUp size={16} className="text-zinc-700" />
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-3 custom-scrollbar">
              {history.length > 0 ? history.map((item) => (
                <div key={item.id} className="relative group flex items-center gap-4 p-4 bg-white/[0.02] rounded-[2rem] border border-white/5 hover:bg-white/[0.05] transition-all">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0 grayscale group-hover:grayscale-0 transition-all duration-500">
                    <img src={item.evidence} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Incident Resolved</p>
                    <div className="flex items-center gap-2 text-zinc-400 text-[11px] font-bold">
                      <Clock size={12} className="text-zinc-600" /> {item.timeStr || 'N/A'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteHistory(item.id)}
                    className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-800 py-20 opacity-20">
                  <ShieldAlert size={60} className="mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest italic text-center">No Data Recorded</p>
                </div>
              )}
            </div>

            <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-2 gap-4">
              <div className="bg-white/[0.02] p-5 rounded-[2rem] border border-white/5">
                <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-2 text-center">Security Score</p>
                <p className="text-2xl font-black italic tracking-tighter text-green-500 text-center">100<span className="text-[10px] not-italic ml-1 opacity-50">%</span></p>
              </div>
              <div className="bg-white/[0.02] p-5 rounded-[2rem] border border-white/5">
                <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-2 text-center">Incidents</p>
                <p className="text-2xl font-black italic tracking-tighter text-white text-center">{history.length}</p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.1); }
      `}</style>
    </div>
  );
}

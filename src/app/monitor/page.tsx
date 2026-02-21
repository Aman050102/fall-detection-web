"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, query, limitToLast } from "firebase/database";
import { useEmergency } from '@/hooks/useEmergency';
import {
  ShieldAlert, Activity, Eye, Clock, History,
  Wifi, WifiOff, PhoneCall, MessageSquare,
  RefreshCcw, AlertTriangle, TrendingUp
} from 'lucide-react';

export default function MonitorPage() {
  const [isEmergency, setIsEmergency] = useState(false);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [fallTime, setFallTime] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const { triggerAlarm, requestPermission } = useEmergency();

  useEffect(() => {
    requestPermission();

    // 1. Connectivity Check & Live View
    onValue(ref(db, 'system/live_stream'), (s) => {
      const data = s.val();
      if (data?.frame) {
        setLiveFrame(data.frame);
        setLastUpdate(Date.now());
      }
    });

    // 2. Alert Panel Logic
    onValue(ref(db, 'system/fall_event'), (s) => {
      const data = s.val();
      if (data?.detected) {
        setIsEmergency(true);
        setEvidence(data.evidence);
        setFallTime(data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "N/A");
        triggerAlarm("Emergency!");
      } else {
        setIsEmergency(false);
      }
    });

    // 3. History Log (Last 10 events)
    const historyRef = query(ref(db, 'history/falls'), limitToLast(10));
    onValue(historyRef, (s) => {
      const data = s.val();
      if (data) setHistory(Object.values(data).reverse());
    });
  }, []);

  const isCameraOffline = Date.now() - lastUpdate > 5000;

  const handleReset = async () => {
    if (evidence) {
      const newHistoryRef = push(ref(db, 'history/falls'));
      await set(newHistoryRef, { evidence, timestamp: Date.now(), timeStr: fallTime });
    }
    await set(ref(db, 'system/fall_event'), { detected: false, evidence: null });
  };

  return (
    <div className={`min-h-screen transition-all duration-500 ${isEmergency ? 'bg-red-950' : 'bg-zinc-950'} text-zinc-100 font-sans`}>

      {/* 1. Header & Connectivity Status */}
      <header className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <ShieldAlert size={24} className="text-white" />
            </div>
            <div>
              <h1 className="font-black uppercase tracking-tighter text-xl leading-none">Guard Vision</h1>
              <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Safety Monitoring System</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold border ${isCameraOffline ? 'border-red-500/50 text-red-500' : 'border-green-500/50 text-green-500'}`}>
              {isCameraOffline ? <WifiOff size={14} /> : <Wifi size={14} />}
              {isCameraOffline ? 'OFFLINE' : 'SYSTEM ONLINE'}
            </div>
            <div className="text-right hidden md:block">
              <p className="text-[10px] text-zinc-500 font-bold uppercase">Current Time</p>
              <p className="text-sm font-mono">{new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT & CENTER: Live View & Alert Panel */}
        <div className="lg:col-span-8 space-y-6">

          {/* 2. Alert Panel (แสดงเมื่อเกิดเหตุ) */}
          {isEmergency && (
            <section className="bg-red-600 rounded-[2rem] p-1 flex flex-col md:flex-row items-center gap-6 animate-pulse shadow-[0_0_40px_rgba(220,38,38,0.4)]">
              <div className="w-full md:w-48 aspect-square rounded-[1.5rem] overflow-hidden border-2 border-white/20">
                <img src={evidence || ""} className="w-full h-full object-cover" alt="Fall Evidence" />
              </div>
              <div className="flex-1 text-center md:text-left py-4">
                <div className="flex items-center justify-center md:justify-start gap-2 text-white/80 text-xs font-bold uppercase mb-1">
                  <AlertTriangle size={16} /> Emergency Detected
                </div>
                <h2 className="text-2xl font-black text-white uppercase italic">ตรวจพบการล้มเมื่อ {fallTime}</h2>
                <p className="text-white/70 text-sm">กรุณาตรวจสอบและกดตอบรับสถานการณ์</p>
              </div>
            </section>
          )}

          {/* 3. Live View (ภาพสด) */}
          <section className="relative aspect-video bg-black rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl group">
            {liveFrame && !isCameraOffline ? (
              <img src={liveFrame} className="w-full h-full object-cover" alt="Live Feed" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700 bg-zinc-900/50">
                <Activity className="animate-spin mb-4" size={48} />
                <p className="text-xs font-black uppercase tracking-[0.4em]">Lost Connection</p>
              </div>
            )}

            <div className="absolute top-6 left-6 flex items-center gap-3">
              <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Live 01</span>
              </div>
            </div>

            {/* 4. Action Bar (ปุ่มควบคุม) */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-xl p-3 rounded-[2rem] border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button onClick={handleReset} className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-2xl font-black text-xs uppercase hover:bg-zinc-200 transition-all active:scale-95">
                <RefreshCcw size={16} /> Reset
              </button>
              <button className="p-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl transition-all border border-white/5">
                <MessageSquare size={20} />
              </button>
              <button className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-2xl transition-all border border-white/5 shadow-lg shadow-red-600/20">
                <PhoneCall size={20} />
              </button>
            </div>
          </section>
        </div>

        {/* RIGHT: History Log & Stats */}
        <div className="lg:col-span-4 space-y-6">

          {/* 5. History Log */}
          <section className="bg-zinc-900/40 rounded-[2.5rem] border border-white/5 p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-zinc-400">
                <History size={18} />
                <h3 className="text-xs font-black uppercase tracking-widest">Recent Logs</h3>
              </div>
              <TrendingUp size={16} className="text-zinc-600" />
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
              {history.length > 0 ? history.map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group">
                  <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                    <img src={item.evidence} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">Fall Recorded</p>
                    <div className="flex items-center gap-1 text-zinc-400 text-[12px] font-medium">
                      <Clock size={12} /> {item.timeStr || 'N/A'}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-700 opacity-30 italic text-xs py-20">
                  No incident history found
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-2 gap-3">
              <div className="bg-white/5 p-4 rounded-2xl">
                <p className="text-[8px] font-black text-zinc-500 uppercase mb-1">Safety Score</p>
                <p className="text-xl font-bold italic tracking-tighter text-green-500">100%</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl">
                <p className="text-[8px] font-black text-zinc-500 uppercase mb-1">Total Falls</p>
                <p className="text-xl font-bold italic tracking-tighter text-white">{history.length}</p>
              </div>
            </div>
          </section>
        </div>

      </main>
    </div>
  );
}

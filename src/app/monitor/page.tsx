"use client";
import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, set, push, query, limitToLast, remove } from "firebase/database";
import { useEmergency } from '@/hooks/useEmergency';
import {
  ShieldAlert, Activity, Eye, Clock, History,
  TrendingUp, Trash2, AlertTriangle, PhoneCall, MessageSquare
} from 'lucide-react';

export default function MonitorPage() {
  const [isEmergency, setIsEmergency] = useState(false);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [fallTime, setFallTime] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  const { triggerAlarm, requestPermission, stopAlarm } = useEmergency();
  const prevEmergencyRef = useRef(false);

  useEffect(() => {
    requestPermission();

    // เช็คสถานะการเชื่อมต่อทุก 3 วินาที
    const timer = setInterval(() => {
      setIsOffline(Date.now() - lastUpdate > 7000);
    }, 3000);

    const liveRef = ref(db, 'system/live_stream');
    const unsubscribeLive = onValue(liveRef, (s) => {
      const data = s.val();
      if (data?.frame) {
        setLiveFrame(data.frame);
        setLastUpdate(Date.now());
        setIsOffline(false);
      }
    });

    const eventRef = ref(db, 'system/fall_event');
    const unsubscribeEvent = onValue(eventRef, (s) => {
      const data = s.val();
      const detected = !!data?.detected;

      if (detected) {
        setIsEmergency(true);
        setEvidence(data.evidence);
        setFallTime(data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "N/A");

        if (!prevEmergencyRef.current) {
          triggerAlarm(`🚨 EMERGENCY: Fall detected at ${new Date().toLocaleTimeString()}`);
        }
      } else {
        setIsEmergency(false);
        stopAlarm();
      }
      prevEmergencyRef.current = detected;
    });

    const historyRef = query(ref(db, 'history/falls'), limitToLast(20));
    const unsubscribeHistory = onValue(historyRef, (s) => {
      const data = s.val();
      if (data) {
        setHistory(Object.entries(data).map(([id, value]: [string, any]) => ({ id, ...value })).reverse());
      } else { setHistory([]); }
    });

    return () => {
      clearInterval(timer);
      unsubscribeLive(); unsubscribeEvent(); unsubscribeHistory();
      stopAlarm();
    };
  }, [lastUpdate]);

  const handleReset = async () => {
    stopAlarm();
    if (evidence) {
      try {
        await set(push(ref(db, 'history/falls')), {
          evidence,
          timestamp: Date.now(),
          timeStr: fallTime
        });
      } catch (err) { console.error(err); }
    }
    await set(ref(db, 'system/fall_event'), { detected: false, evidence: null });
  };

  const handleDeleteHistory = async (id: string) => {
    if (window.confirm("Delete record?")) {
      await remove(ref(db, `history/falls/${id}`));
    }
  };

  return (
    <div className={`min-h-screen transition-all duration-700 ${isEmergency ? 'bg-red-950' : 'bg-[#050505]'} text-zinc-100 font-sans`}>
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-2xl transition-all ${isEmergency ? 'bg-red-600 shadow-lg' : 'bg-blue-600 shadow-md'}`}>
              <ShieldAlert size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-black uppercase tracking-tighter text-xl italic">Guard Vision</h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Protocol Stable</p>
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
                <h2 className="text-2xl font-black text-white uppercase italic">Fall Detected</h2>
                <p className="text-white/80 font-bold text-xs uppercase">Time: {fallTime}</p>
                <button onClick={handleReset} className="mt-4 bg-white text-red-600 px-8 py-3 rounded-xl font-black uppercase text-xs hover:scale-105 transition-all">Resolve Incident</button>
              </div>
            </section>
          )}

          <section className="relative aspect-video bg-zinc-900 rounded-[3rem] overflow-hidden border border-white/5 shadow-2xl group">
            {liveFrame && !isOffline ? (
              <img src={liveFrame} className="w-full h-full object-cover transition-opacity duration-300" alt="Live Feed" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700">
                <Activity className="animate-pulse mb-4" size={48} />
                <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Signal...</p>
              </div>
            )}
            <div className="absolute top-8 left-8 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isOffline ? 'bg-zinc-600' : 'bg-red-500 animate-pulse'}`} />
              <span className="text-[9px] font-bold uppercase text-white tracking-widest">Channel_01</span>
            </div>
          </section>
        </div>

        <div className="lg:col-span-4">
          <section className="bg-zinc-900/30 backdrop-blur-xl rounded-[2.5rem] border border-white/5 p-6 h-full flex flex-col shadow-xl">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
              <History size={14} /> Incident Logs
            </h3>
            <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
              {history.map((item) => (
                <div key={item.id} className="group flex items-center gap-4 p-3 bg-white/[0.03] rounded-2xl border border-white/5 hover:bg-white/[0.06] transition-all">
                  <img src={item.evidence} className="w-12 h-12 rounded-lg object-cover grayscale group-hover:grayscale-0" />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-zinc-400">{item.timeStr}</p>
                  </div>
                  <button onClick={() => handleDeleteHistory(item.id)} className="p-2 text-zinc-600 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
      `}</style>
    </div>
  );
}

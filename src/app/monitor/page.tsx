"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { ref, onValue, set, query, limitToLast, remove, off } from "firebase/database";
import { useEmergency } from "@/hooks/useEmergency";
import { ShieldAlert, Activity, History, Trash2, Home } from "lucide-react";

const CLOUDFLARE_WORKER_URL = "https://cctv-stream-worker.aman02012548.workers.dev";

interface HistoryItem { id: string; evidence?: string; timestamp?: number; timeStr?: string; }

export default function MonitorPage() {
  const [isEmergency, setIsEmergency] = useState(false);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<string | null>(null);
  const [fallTime, setFallTime] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  const lastUpdateRef = useRef<number>(Date.now());
  const prevEmergencyRef = useRef(false);
  const { triggerAlarm, requestPermission, stopAlarm } = useEmergency();

  useEffect(() => {
    requestPermission();

    // 🔴 1. ULTRA LOW LATENCY FETCH
    let isMounted = true;
    let controller = new AbortController();

    const fetchLiveStream = async () => {
      if (!isMounted) return;

      // ยกเลิก Request ที่ค้างนานเกินไป เพื่อรับอันใหม่ที่สดกว่า
      controller.abort();
      controller = new AbortController();

      try {
        const res = await fetch(CLOUDFLARE_WORKER_URL, {
          cache: 'no-cache',      // ห้ามใช้ Cache เด็ดขาด
          mode: 'cors',
          priority: 'high',       // ให้ความสำคัญสูงสุด
          signal: controller.signal
        });

        if (res.ok) {
          const data = await res.json();
          if (data.frame) {
            setLiveFrame(data.frame);
            lastUpdateRef.current = Date.now();
            setIsOffline(false);
          }
        }
      } catch (e) {
        // ข้าม Error ที่เกิดจากการ Abort หรือ Network กระตุก
      }

      // ⚡ ปรับเป็น 10ms (รัวที่สุดเท่าที่เบราว์เซอร์จะรับได้)
      // เพื่อให้ดึงภาพทันทีที่ Edge Node อัปเดตข้อมูลสำเร็จ
      setTimeout(fetchLiveStream, 10);
    };

    fetchLiveStream();

    // 🔥 2. FALL EVENT (Firebase - คงเดิม)
    const eventRef = ref(db, "system/fall_event");
    onValue(eventRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      setIsEmergency(data.detected);
      setEvidence(data.evidence);
      if (data.timestamp) setFallTime(new Date(data.timestamp).toLocaleString());
      if (data.detected && !prevEmergencyRef.current) triggerAlarm("Emergency: Fall detected");
      if (!data.detected) stopAlarm();
      prevEmergencyRef.current = data.detected;
    });

    // 📜 3. HISTORY (Firebase - คงเดิม)
    const historyRef = query(ref(db, "history/falls"), limitToLast(20));
    onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setHistory([]); return; }
      const parsed = Object.entries(data).map(([id, val]: any) => ({
        id, evidence: val.evidence, timestamp: val.timestamp, timeStr: val.timeStr
      })).reverse();
      setHistory(parsed);
    });

    const offlineTimer = setInterval(() => {
      if (Date.now() - lastUpdateRef.current > 5000) setIsOffline(true);
    }, 2000);

    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(offlineTimer);
      off(eventRef);
      off(historyRef);
      stopAlarm();
    };
  }, [triggerAlarm, stopAlarm, requestPermission]);

  const handleReset = async () => {
    stopAlarm();
    await set(ref(db, "system/fall_event"), { detected: false, evidence: null, timestamp: null });
  };

  const handleDeleteHistory = async (id: string) => {
    if (window.confirm("ต้องการลบประวัตินี้หรือไม่?")) await remove(ref(db, `history/falls/${id}`));
  };

  return (
    <div className={`min-h-screen transition-all duration-700 ${isEmergency ? "bg-red-950" : "bg-[#050505]"} text-zinc-100`}>
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/"><div className="p-2.5 bg-zinc-800 rounded-2xl cursor-pointer"><Home size={20} className="text-zinc-400" /></div></Link>
            <div className={`p-2.5 rounded-2xl ${isEmergency ? "bg-red-600 animate-pulse" : "bg-blue-600"}`}><ShieldAlert size={22} className="text-white" /></div>
            <div><h1 className="font-black uppercase text-xl italic leading-none">Monitor Hub</h1><p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">Paid Protocol Active</p></div>
          </div>
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black border ${isOffline ? "border-red-500 text-red-500 bg-red-500/5" : "border-green-500 text-green-500 bg-green-500/5"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isOffline ? "bg-red-500" : "bg-green-500 animate-pulse"}`} />
            {isOffline ? "CAM OFFLINE" : "LIVE STREAM"}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          {isEmergency && (
            <section className="bg-red-600 rounded-[2.5rem] p-6 flex flex-col md:flex-row gap-6 items-center transition-all">
              {evidence && <img src={evidence} className="w-48 aspect-square rounded-2xl object-cover shadow-2xl" alt="Evidence" />}
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl font-black uppercase italic">Fall Event Detected</h2>
                <p className="text-sm font-bold opacity-80 mt-1">Alert Time: {fallTime ?? "-"}</p>
                <button onClick={handleReset} className="mt-6 bg-white text-red-600 px-8 py-3 rounded-2xl font-black transition-all shadow-xl active:scale-95">RESOLVE ALERT</button>
              </div>
            </section>
          )}

          <section className="relative aspect-video bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl">
            {liveFrame && !isOffline ? (
              <img src={liveFrame} className="w-full h-full object-cover" alt="Live Feed" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 bg-zinc-950">
                <Activity className="animate-pulse mb-4" size={48} />
                <p className="font-bold uppercase tracking-widest text-sm">Waiting for Cloudflare Data...</p>
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-4">
          <section className="bg-zinc-900 rounded-[2.5rem] p-8 h-full border border-white/5 shadow-2xl">
            <h3 className="text-xs font-bold uppercase mb-6 flex items-center gap-2 text-zinc-400"><History size={14} /> Incident Logs (Firebase)</h3>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {history.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                  {item.evidence && <img src={item.evidence} className="w-16 h-16 rounded-xl object-cover shadow-lg" />}
                  <div className="flex-1"><p className="text-[11px] font-bold text-zinc-200">{item.timeStr ?? "-"}</p><p className="text-[9px] uppercase font-black text-red-500/80 mt-1">Log Saved</p></div>
                  <button onClick={() => handleDeleteHistory(item.id)} className="p-2 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

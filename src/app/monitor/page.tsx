"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { ref, onValue, set, query, limitToLast, remove, off } from "firebase/database";
import { useEmergency } from "@/hooks/useEmergency";
import { ShieldAlert, Activity, History, Trash2, Home } from "lucide-react";

const CLOUDFLARE_WORKER_URL = "https://cctv-stream-worker.aman02012548.workers.dev";

export default function MonitorPage() {
  const [isEmergency, setIsEmergency] = useState(false);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<string | null>(null);
  const [fallTime, setFallTime] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  const lastUpdateRef = useRef<number>(Date.now());
  const prevEmergencyRef = useRef(false);
  const isMounted = useRef(true);
  const { triggerAlarm, requestPermission, stopAlarm } = useEmergency();

  // ---------------- TURBO FETCH (CLOUDFLARE) ----------------
  const fetchLiveStream = useCallback(() => {
    if (!isMounted.current) return;
    
    const timestamp = Date.now();
    const img = new Image();
    img.src = `${CLOUDFLARE_WORKER_URL}?t=${timestamp}`;

    img.onload = () => {
      if (!isMounted.current) return;
      setLiveFrame(img.src);
      lastUpdateRef.current = Date.now();
      setIsOffline(false);
      // ดึงภาพถัดไปทันทีที่วาดเสร็จเพื่อความต่อเนื่อง
      requestAnimationFrame(fetchLiveStream);
    };

    img.onerror = () => {
      if (isMounted.current) setTimeout(fetchLiveStream, 500);
    };
  }, []);

  useEffect(() => {
    isMounted.current = true;
    requestPermission();
    fetchLiveStream();

    // ฟังเหตุการณ์แจ้งเตือนและประวัติจาก Firebase
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

    const historyRef = query(ref(db, "history/falls"), limitToLast(20));
    onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setHistory([]); return; }
      const parsed = Object.entries(data).map(([id, val]: any) => ({
        id, ...val
      })).reverse();
      setHistory(parsed);
    });

    const offlineTimer = setInterval(() => {
      if (Date.now() - lastUpdateRef.current > 4000) setIsOffline(true);
    }, 2000);

    return () => {
      isMounted.current = false;
      clearInterval(offlineTimer);
      off(eventRef);
      off(historyRef);
      stopAlarm();
    };
  }, [fetchLiveStream, triggerAlarm, stopAlarm, requestPermission]);

  const handleReset = async () => {
    stopAlarm();
    await set(ref(db, "system/fall_event"), { detected: false, evidence: null, timestamp: null });
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isEmergency ? "bg-red-950" : "bg-black"} text-white font-sans`}>
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/"><div className="p-2.5 bg-zinc-800 rounded-2xl"><Home size={20} className="text-zinc-400" /></div></Link>
          <div className={`p-2.5 rounded-2xl ${isEmergency ? "bg-red-600 animate-pulse" : "bg-blue-600"}`}><ShieldAlert size={22} className="text-white" /></div>
          <h1 className="font-black italic text-xl uppercase tracking-tighter">Live Monitor</h1>
        </div>
        <div className={`px-4 py-1 rounded-full text-[10px] font-black border ${isOffline ? "border-red-500 text-red-500" : "border-green-500 text-green-500"}`}>
          {isOffline ? "CONNECTION LOST" : "EDGE FEED ACTIVE"}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          {isEmergency && (
            <section className="bg-red-600 rounded-[2.5rem] p-6 flex flex-col md:flex-row gap-6 items-center shadow-2xl">
              {evidence && <img src={evidence} className="w-48 aspect-square rounded-2xl object-cover shadow-2xl" alt="Fall Evidence" />}
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-3xl font-black uppercase italic">Fall Event Detected</h2>
                <p className="text-sm font-bold opacity-80">Incident Time: {fallTime ?? "-"}</p>
                <button onClick={handleReset} className="mt-6 bg-white text-red-600 px-8 py-3 rounded-2xl font-black shadow-xl">RESOLVE ALERT</button>
              </div>
            </section>
          )}

          <section className="relative aspect-video bg-zinc-950 rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl flex items-center justify-center">
            {liveFrame && !isOffline ? (
              <img src={liveFrame} className="w-full h-full object-contain bg-black" style={{ willChange: 'transform' }} alt="Live Streaming" />
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-700">
                <Activity className="animate-pulse mb-4" size={48} /><p className="font-bold uppercase tracking-widest text-xs">Waiting for Edge Stream...</p>
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-4">
          <section className="bg-zinc-900/50 rounded-[2.5rem] p-8 h-full border border-white/5 backdrop-blur-md flex flex-col">
            <h3 className="text-xs font-bold uppercase mb-6 flex items-center gap-2 text-zinc-400"><History size={14} /> Incident Logs</h3>
            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              {history.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                  {item.evidence && <img src={item.evidence} className="w-16 h-16 rounded-xl object-cover" alt="Thumb" />}
                  <div className="flex-1 text-[11px] font-bold"><p className="text-zinc-200">{item.timeStr ?? "-"}</p><p className="text-red-500/80 uppercase">Log Saved</p></div>
                  <button onClick={() => remove(ref(db, `history/falls/${item.id}`))} className="p-2 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
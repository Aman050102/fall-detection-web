"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, set } from "firebase/database";
import { useEmergency } from '@/hooks/useEmergency';
import { ShieldAlert, Activity, Eye } from 'lucide-react';

export default function MonitorPage() {
  const [isEmergency, setIsEmergency] = useState(false);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<string | null>(null);
  const { triggerAlarm, requestPermission } = useEmergency();

  useEffect(() => {
    requestPermission();
    // รับภาพสด
    onValue(ref(db, 'system/live_stream'), (s) => setLiveFrame(s.val()?.frame));
    // รับแจ้งเตือนล้ม
    onValue(ref(db, 'system/fall_event'), (s) => {
      const data = s.val();
      if (data?.detected) {
        setIsEmergency(true);
        setEvidence(data.evidence);
        triggerAlarm("🚨 ตรวจพบการล้ม! ตรวจสอบด่วน");
      }
    });
  }, []);

  const reset = async () => {
    setIsEmergency(false);
    await set(ref(db, 'system/fall_event'), { detected: false });
  };

  return (
    <div className={`min-h-screen p-6 transition-colors ${isEmergency ? 'bg-red-950' : 'bg-black'}`}>
      <nav className="flex items-center gap-2 text-white mb-8">
        <ShieldAlert className="text-blue-500" size={24} />
        <span className="font-black italic uppercase tracking-tighter">Guard Monitor</span>
      </nav>

      <div className="flex flex-col items-center">
        {isEmergency ? (
          <div className="w-full max-w-sm text-center space-y-6 animate-in zoom-in">
            <div className="rounded-3xl overflow-hidden border-4 border-red-600 shadow-2xl">
              <img src={evidence || ""} alt="Evidence" className="w-full" />
            </div>
            <h2 className="text-white text-3xl font-black italic uppercase animate-pulse">Fall Detected!</h2>
            <button onClick={reset} className="w-full bg-white text-red-600 py-4 rounded-2xl font-bold shadow-xl">รับทราบเหตุการณ์</button>
          </div>
        ) : (
          <div className="w-full max-w-lg space-y-4">
            <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest px-2">
              <Eye size={14} className="text-green-500" /> Live Feed
            </div>
            <div className="aspect-square bg-zinc-900 rounded-[2.5rem] overflow-hidden border border-zinc-800 shadow-2xl">
              {liveFrame ? <img src={liveFrame} className="w-full h-full object-cover" /> : <div className="flex h-full items-center justify-center text-zinc-700 font-bold"><Activity className="animate-pulse mr-2" /> Connecting...</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

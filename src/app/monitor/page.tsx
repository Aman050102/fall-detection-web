"use client";
import React, { useState, useEffect } from 'react';
import { ShieldAlert, Bell, Activity } from 'lucide-react';
import { useEmergency } from '@/hooks/useEmergency';
import { db } from '@/lib/firebase';
import { ref, onValue, set } from "firebase/database";

export default function MonitorPage() {
  const [isEmergency, setIsEmergency] = useState(false);
  const { triggerAlarm, requestPermission } = useEmergency();

  useEffect(() => {
    requestPermission();
    const fallRef = ref(db, 'system/fall_event');
    const unsubscribe = onValue(fallRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.detected === true) {
        setIsEmergency(true);
        triggerAlarm("🚨 ตรวจพบการล้มที่ห้องหลัก! กรุณาตรวจสอบด่วน");
      }
    });
    return () => unsubscribe();
  }, []);

  const resetAlert = async () => {
    setIsEmergency(false);
    await set(ref(db, 'system/fall_event'), { detected: false, timestamp: Date.now() });
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-500 ${isEmergency ? 'bg-red-950 shadow-[inset_0_0_100px_rgba(220,38,38,0.5)]' : 'bg-black'}`}>
      <nav className="p-6 border-b border-zinc-900 flex justify-between items-center bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <ShieldAlert className="text-blue-500" size={24} />
          <span className="font-black text-white uppercase italic tracking-tighter">Guard Monitor</span>
        </div>
      </nav>
      <div className="flex-grow flex flex-col items-center justify-center p-8">
        {isEmergency ? (
          <div className="text-center animate-in scale-in">
            <div className="bg-red-600 p-10 rounded-full inline-block mb-6 shadow-[0_0_80px_#dc2626] animate-bounce">
              <Bell size={64} className="text-white" />
            </div>
            <h2 className="text-5xl font-black text-white uppercase italic mb-8 tracking-tighter">FALL DETECTED!</h2>
            <button onClick={resetAlert} className="w-full max-w-xs bg-white text-red-600 font-black py-5 rounded-2xl shadow-2xl active:scale-95 transition-transform text-xl">รับทราบเหตุการณ์</button>
          </div>
        ) : (
          <div className="text-center space-y-8 opacity-40">
            <Activity size={80} className="text-zinc-800 mx-auto animate-pulse" />
            <h2 className="text-xl font-bold text-zinc-500 uppercase tracking-[0.3em]">Monitoring...</h2>
          </div>
        )}
      </div>
    </div>
  );
}

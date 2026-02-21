"use client";
import React, { useState } from 'react';
import FallDetector from '@/components/FallDetector';
import { db } from '@/lib/firebase';
import { ref, set } from "firebase/database";
import { Radio } from 'lucide-react';

export default function CameraPage() {
  const [isAlert, setIsAlert] = useState(false);

  const handleFallDetected = async () => {
    if (isAlert) return;
    setIsAlert(true);

    try {
      await set(ref(db, 'system/fall_event'), {
        detected: true,
        timestamp: Date.now()
      });
    } catch (e) { console.error("Firebase Sync Error:", e); }

    setTimeout(() => setIsAlert(false), 5000);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col p-4">
      <div className="flex justify-between items-center mb-4 px-2">
        <div className="flex items-center gap-2">
          <Radio className="text-red-600 animate-pulse" size={18} />
          <span className="text-white font-bold tracking-widest uppercase text-[10px]">Live CCTV Node 01</span>
        </div>
        <div className="text-zinc-700 text-[10px] font-mono tracking-tighter uppercase">AI Processor: Active</div>
      </div>
      <div className={`relative flex-grow rounded-[2rem] overflow-hidden border-2 transition-all duration-300 ${isAlert ? 'border-red-600 shadow-[0_0_40px_rgba(220,38,38,0.4)]' : 'border-zinc-900'}`}>
        <FallDetector onFallDetected={handleFallDetected} />
        {isAlert && (
          <div className="absolute inset-0 bg-red-600/10 backdrop-blur-sm flex items-center justify-center z-20">
            <div className="bg-red-600 text-white px-8 py-4 rounded-full font-black text-xl animate-bounce shadow-2xl">
              FALL DETECTED!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";
import React, { useState } from 'react';
import FallDetector from '@/components/FallDetector';
import { Radio } from 'lucide-react';
// import { db } from '@/lib/firebase'; // รอเปิดใช้งานหลังแก้ MFA
// import { ref, set } from "firebase/database";

export default function CameraPage() {
  const [isAlert, setIsAlert] = useState(false);

  const handleFallDetected = async () => {
    if (isAlert) return;
    setIsAlert(true);
    console.log("ALERT: FALL DETECTED!");

    // ตรงนี้คือจุดส่งสัญญาณไป Firebase
    // await set(ref(db, 'system/fall_event'), { detected: true, timestamp: Date.now() });

    setTimeout(() => setIsAlert(false), 5000);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col p-4">
      <div className="flex justify-between items-center mb-4 px-2">
        <div className="flex items-center gap-2">
          <Radio className="text-red-600 animate-pulse" size={20} />
          <span className="text-white font-bold text-sm tracking-widest uppercase">CCTV Node 01</span>
        </div>
        <div className="text-[10px] text-zinc-500 font-mono">640x640 | WASM_BACKEND</div>
      </div>

      <div className={`relative flex-grow rounded-[2rem] overflow-hidden border-2 transition-colors duration-300 ${isAlert ? 'border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.3)]' : 'border-zinc-800'}`}>
        <FallDetector onFallDetected={handleFallDetected} />

        {isAlert && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-red-600/10 backdrop-blur-[1px]">
            <div className="bg-red-600 text-white px-6 py-3 rounded-full font-black animate-bounce shadow-2xl">
              FALL DETECTED!
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between px-4 text-[10px] font-bold text-zinc-600 uppercase">
        <span>System Status: Online</span>
        <span>AI Confidence: 0.65</span>
      </div>
    </div>
  );
}

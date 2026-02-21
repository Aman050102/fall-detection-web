"use client";
import React, { useState, useEffect, useRef } from 'react';
import FallDetector from '@/components/FallDetector';
import { db } from '@/lib/firebase';
import { ref, set } from "firebase/database";
import { Radio } from 'lucide-react';

export default function CameraPage() {
  const [isAlert, setIsAlert] = useState(false);
  const lastStreamTime = useRef(0);

  // ส่งภาพสด (Live Stream) ไปยัง Firebase
  const streamLive = () => {
    const canvas = document.querySelector('canvas');
    const now = Date.now();
    if (canvas && now - lastStreamTime.current > 500) {
      const frame = canvas.toDataURL('image/jpeg', 0.2); // บีบอัดมากเพื่อความเร็ว
      set(ref(db, 'system/live_stream'), { frame });
      lastStreamTime.current = now;
    }
  };

  const handleFallDetected = async () => {
    if (isAlert) return;
    setIsAlert(true);

    // แคปรูปหลักฐาน (คุณภาพสูงกว่าภาพสด)
    const canvas = document.querySelector('canvas');
    const evidence = canvas ? canvas.toDataURL('image/jpeg', 0.6) : null;

    await set(ref(db, 'system/fall_event'), {
      detected: true,
      evidence: evidence,
      timestamp: Date.now()
    });

    setTimeout(() => setIsAlert(false), 5000);
  };

  useEffect(() => {
    const interval = setInterval(streamLive, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black p-4 flex flex-col items-center">
      <div className="flex items-center gap-2 text-red-500 mb-4 font-bold text-xs uppercase tracking-widest">
        <Radio className="animate-pulse" size={16} /> <span>Live Stream Active</span>
      </div>
      <div className={`w-full max-w-2xl aspect-square rounded-[2rem] overflow-hidden border-2 transition-all ${isAlert ? 'border-red-600 shadow-[0_0_40px_rgba(220,38,38,0.5)]' : 'border-zinc-800'}`}>
        <FallDetector onFallDetected={handleFallDetected} />
      </div>
    </div>
  );
}

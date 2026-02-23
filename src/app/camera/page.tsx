"use client";
import React, { useState, useEffect, useRef } from 'react';
import FallDetector from '@/components/FallDetector';
import { db } from '@/lib/firebase';
import { ref, set, serverTimestamp } from "firebase/database";
import { Cpu, ShieldCheck, RefreshCw } from 'lucide-react'; // เพิ่ม Icon สำหรับสลับกล้อง

export default function CameraPage() {
  const [isAlert, setIsAlert] = useState(false);
  const [fps, setFps] = useState(0);
  // เพิ่ม State สำหรับจัดการการสลับกล้อง
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const lastStreamTime = useRef(0);
  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(0);
  const isUploading = useRef(false);

  // ฟังก์ชันสลับกล้อง
  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const streamLive = async () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const now = Date.now();
    frameCount.current++;
    
    if (now - lastFpsUpdate.current > 1000) {
      setFps(frameCount.current);
      frameCount.current = 0;
      lastFpsUpdate.current = now;
    }

    if (now - lastStreamTime.current > 1000 && !isUploading.current) {
      isUploading.current = true;
      try {
        const frame = canvas.toDataURL('image/jpeg', 0.1);
        await set(ref(db, 'system/live_stream'), {
          frame,
          lastActive: serverTimestamp(),
          fps: frameCount.current
        });
        lastStreamTime.current = now;
      } catch (error) {
        console.error("Stream Error:", error);
      } finally {
        isUploading.current = false;
      }
    }
  };

  const handleFallDetected = async () => {
    if (isAlert) return;
    setIsAlert(true);
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    const evidence = canvas ? canvas.toDataURL('image/jpeg', 0.5) : null;

    try {
      await set(ref(db, 'system/fall_event'), {
        detected: true,
        evidence,
        timestamp: serverTimestamp(),
      });
    } catch (error) { console.error("Alert Error:", error); }

    setTimeout(() => setIsAlert(false), 5000);
  };

  useEffect(() => {
    const interval = setInterval(streamLive, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-5xl space-y-4">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-2">
           <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${isAlert ? 'bg-red-500' : 'bg-blue-500'}`} />
              <h1 className="text-xs font-bold tracking-widest uppercase opacity-70">
                {facingMode === 'user' ? 'Front Cam' : 'Rear Cam'} Live
              </h1>
           </div>
           {/* แสดง FPS ปัจจุบันแบบจางๆ */}
           <div className="text-[10px] font-mono opacity-40 uppercase tracking-widest">
             Stream Rate: {fps}Hz
           </div>
        </div>

        {/* MAIN CAMERA VIEW */}
        <div className={`relative aspect-video rounded-3xl overflow-hidden border-2 transition-all duration-500 bg-zinc-950 ${isAlert ? 'border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.2)]' : 'border-white/10'}`}>
          
          {/* ส่ง facingMode ที่เปลี่ยนในหน้านี้ลงไปให้ FallDetector */}
          <FallDetector onFallDetected={handleFallDetected} facingMode={facingMode} />

          {/* HUD Overlay */}
          <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
               <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-bold">
                 {isAlert ? '● EMERGENCY' : '● LIVE'}
               </div>

               {/* ปุ่มสลับกล้อง (เปิดให้กดได้ด้วย pointer-events-auto) */}
               <button 
                onClick={toggleCamera}
                className="pointer-events-auto p-3 bg-white/10 hover:bg-white/20 active:scale-90 backdrop-blur-xl rounded-2xl border border-white/10 transition-all shadow-xl"
                title="Switch Camera"
               >
                 <RefreshCw size={20} className="text-white" />
               </button>
            </div>

            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-blue-400">
                  <Cpu size={12} />
                  <span className="text-[10px] font-black uppercase tracking-tighter">AI_ENGINE_V2</span>
                </div>
                <p className="text-[10px] font-mono opacity-70 text-zinc-400 uppercase tracking-widest">Status: Nominal</p>
              </div>
            </div>
          </div>

          {/* Alert Overlay */}
          {isAlert && (
            <div className="absolute inset-0 bg-red-600/20 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-2xl italic uppercase animate-bounce shadow-2xl border-2 border-white/20">
                FALL DETECTED
              </div>
            </div>
          )}
        </div>

        {/* Bottom Status Panel */}
        <div className="flex justify-between items-center px-4 py-3 bg-zinc-900/50 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
            <ShieldCheck size={14} className="text-blue-500" />
            End-to-End Encryption
          </div>
          <div className="text-[10px] font-bold text-zinc-500 font-mono">
            {new Date().toLocaleTimeString('en-GB', { hour12: false })}
          </div>
        </div>

      </div>
    </div>
  );
}
"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import FallDetector from '@/components/FallDetector';
import { db } from '@/lib/firebase';
import { ref, set, push, serverTimestamp } from "firebase/database";
import { Cpu, ShieldCheck, RefreshCw, Home } from 'lucide-react';

export default function CameraPage() {
  const [isAlert, setIsAlert] = useState(false);
  const [fps, setFps] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [mounted, setMounted] = useState(false);

  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(0);
  const lastStreamTime = useRef(0);
  const isUploading = useRef(false);
  const streamCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const streamLive = async () => {
    const mainCanvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!mainCanvas || isUploading.current) return;

    const now = Date.now();
    frameCount.current++;

    if (now - lastFpsUpdate.current > 1000) {
      setFps(frameCount.current);
      frameCount.current = 0;
      lastFpsUpdate.current = now;
    }

    // ✅ รีดสปีดสูงสุด: ส่งภาพทุกๆ 150ms ไปยัง Firebase แบบจิ๋ว (ลื่นและฟรี)
    if (now - lastStreamTime.current > 150) {
      isUploading.current = true;
      try {
        if (!streamCanvasRef.current) {
          streamCanvasRef.current = document.createElement('canvas');
        }

        const sCanvas = streamCanvasRef.current;
        const sCtx = sCanvas.getContext('2d');

        sCanvas.width = 320;
        sCanvas.height = 320;

        // ❗ ไม่ mirror ตอนอัปโหลด
        sCtx?.drawImage(mainCanvas, 0, 0, 320, 320);

        const frame = sCanvas.toDataURL('image/jpeg', 0.4);

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

    const mainCanvas = document.querySelector('canvas') as HTMLCanvasElement;
    const evidence = mainCanvas ? mainCanvas.toDataURL('image/jpeg', 0.6) : null;

    try {
      await set(ref(db, 'system/fall_event'), {
        detected: true,
        evidence,
        timestamp: serverTimestamp(),
      });

      const historyRef = ref(db, 'history/falls');
      const newHistoryEntry = push(historyRef);

      await set(newHistoryEntry, {
        evidence,
        timestamp: serverTimestamp(),
        timeStr: new Date().toLocaleTimeString('th-TH'),
      });

    } catch (error) {
      console.error("🚨 Firebase Save Error:", error);
    }

    setTimeout(() => setIsAlert(false), 10000);
  };

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(streamLive, 100);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-5xl space-y-4">

        {/* HEADER */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${isAlert ? 'bg-red-500' : 'bg-blue-500'}`} />
            <h1 className="text-xs font-bold tracking-widest uppercase opacity-70">
              {facingMode === 'user' ? 'Front' : 'Rear'} Cam Stable
            </h1>
          </div>

          <div className="text-[10px] font-mono opacity-40 uppercase tracking-widest">
            Stream Rate: {fps}Hz
          </div>
        </div>

        {/* CAMERA VIEW */}
        <div className={`relative aspect-video rounded-[2.5rem] overflow-hidden border-2 transition-all duration-500 bg-zinc-950 ${isAlert ? 'border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.2)]' : 'border-white/10'}`}>

          {/* ✅ Mirror Effect เฉพาะ Front Camera */}
          <div
            className="w-full h-full transition-transform duration-500"
            style={{
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)'
            }}
          >
            <FallDetector
              onFallDetected={handleFallDetected}
              facingMode={facingMode}
            />
          </div>

          {/* HUD Overlay */}
          <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-bold">
                {isAlert ? '● EMERGENCY' : '● LIVE'}
              </div>
              <div className="flex gap-2 pointer-events-auto">
                <Link href="/">
                  <button className="p-3 bg-white/10 hover:bg-white/20 active:scale-90 backdrop-blur-xl rounded-2xl border border-white/10 transition-all shadow-xl">
                    <Home size={20} />
                  </button>
                </Link>

                <button
                  onClick={toggleCamera}
                  className="p-3 bg-white/10 hover:bg-white/20 active:scale-90 backdrop-blur-xl rounded-2xl border border-white/10 transition-all shadow-xl"
                >
                  <RefreshCw size={20} />
                </button>
              </div>
            </div>
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-blue-400">
                  <Cpu size={12} />
                  <span className="text-[10px] font-black uppercase tracking-tighter">
                    AI_GUARD_V2
                  </span>
                </div>
                <p className="text-[10px] font-mono opacity-70 text-zinc-400 uppercase tracking-widest">
                  Status: Ready
                </p>
              </div>
            </div>
          </div>

          {/* ALERT SCREEN */}
          {isAlert && (
            <div className="absolute inset-0 bg-red-600/20 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-2xl italic uppercase animate-bounce shadow-2xl border-2 border-white/20">FALL DETECTED</div>
            </div>
          )}
        </div>

        {/* FOOTER STATUS */}
        <div className="flex justify-between items-center px-4 py-3 bg-zinc-900/50 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
            <ShieldCheck size={14} className="text-blue-500" />
            Security Protocol Active
          </div>

          <div className="text-[10px] font-bold text-zinc-500 font-mono italic">
            {mounted ? new Date().toLocaleTimeString('en-GB') : "--:--:--"}
          </div>
        </div>

      </div>
    </div>
  );
}
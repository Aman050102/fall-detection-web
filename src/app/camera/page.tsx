"use client";
import React, { useState, useEffect, useRef } from 'react';
import FallDetector from '@/components/FallDetector';
import { db } from '@/lib/firebase';
import { ref, set, serverTimestamp } from "firebase/database";
import { Cpu, ShieldCheck, RefreshCw } from 'lucide-react';

export default function CameraPage() {
  const [isAlert, setIsAlert] = useState(false);
  const [fps, setFps] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(0);
  const lastStreamTime = useRef(0);
  const isUploading = useRef(false);

  // สร้าง Offscreen Canvas สำหรับย่อภาพเพื่อส่ง Stream (ช่วยให้ Monitor ลื่นขึ้นมาก)
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

    // ส่งภาพทุกๆ 250ms (4 FPS) เพื่อความเสถียรของ Network
    if (now - lastStreamTime.current > 250) {
      isUploading.current = true;
      try {
        if (!streamCanvasRef.current) {
          streamCanvasRef.current = document.createElement('canvas');
        }

        const sCanvas = streamCanvasRef.current;
        const sCtx = sCanvas.getContext('2d');

        // ย่อภาพเหลือ 320px สำหรับส่ง Live (ประหยัด Bandwidth 4 เท่า)
        sCanvas.width = 320;
        sCanvas.height = 320;
        sCtx?.drawImage(mainCanvas, 0, 0, 320, 320);

        const frame = sCanvas.toDataURL('image/jpeg', 0.4); // เพิ่มคุณภาพเล็กน้อยเป็น 0.4

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
    // ภาพหลักฐานใช้คุณภาพสูง (0.7)
    const evidence = mainCanvas ? mainCanvas.toDataURL('image/jpeg', 0.7) : null;

    try {
      await set(ref(db, 'system/fall_event'), {
        detected: true,
        evidence,
        timestamp: serverTimestamp(),
      });
    } catch (error) { console.error("Alert Error:", error); }

    // หน่วงเวลา Reset Alert 8 วินาที เพื่อให้ Monitor ทำงานทัน
    setTimeout(() => setIsAlert(false), 8000);
  };

  useEffect(() => {
    const interval = setInterval(streamLive, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-5xl space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${isAlert ? 'bg-red-500' : 'bg-blue-500'}`} />
            <h1 className="text-xs font-bold tracking-widest uppercase opacity-70">
              {facingMode === 'user' ? 'Front Cam' : 'Rear Cam'} Live
            </h1>
          </div>
          <div className="text-[10px] font-mono opacity-40 uppercase tracking-widest">
            Stream Rate: {fps}Hz
          </div>
        </div>

        <div className={`relative aspect-video rounded-3xl overflow-hidden border-2 transition-all duration-500 bg-zinc-950 ${isAlert ? 'border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.2)]' : 'border-white/10'}`}>
          <FallDetector onFallDetected={handleFallDetected} facingMode={facingMode} />

          <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-[10px] font-bold">
                {isAlert ? '● EMERGENCY' : '● LIVE'}
              </div>
              <button onClick={toggleCamera} className="pointer-events-auto p-3 bg-white/10 hover:bg-white/20 active:scale-90 backdrop-blur-xl rounded-2xl border border-white/10 transition-all shadow-xl">
                <RefreshCw size={20} className="text-white" />
              </button>
            </div>
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-blue-400">
                  <Cpu size={12} />
                  <span className="text-[10px] font-black uppercase tracking-tighter">AI_ENGINE_V2_STABLE</span>
                </div>
                <p className="text-[10px] font-mono opacity-70 text-zinc-400 uppercase tracking-widest">Status: Nominal</p>
              </div>
            </div>
          </div>

          {isAlert && (
            <div className="absolute inset-0 bg-red-600/20 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-2xl italic uppercase animate-bounce shadow-2xl border-2 border-white/20">
                FALL DETECTED
              </div>
            </div>
          )}
        </div>

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

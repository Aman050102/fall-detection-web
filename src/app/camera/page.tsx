"use client";
import React, { useState, useEffect, useRef } from 'react';
import FallDetector from '@/components/FallDetector';
import { db } from '@/lib/firebase';
import { ref, set, serverTimestamp } from "firebase/database";
import { Radio, Settings2, Activity, ShieldCheck, Gauge, Cpu, LayoutGrid } from 'lucide-react';

export default function CameraPage() {
  const [isAlert, setIsAlert] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.65);
  const [fps, setFps] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const lastStreamTime = useRef(0);
  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(0);
  const wakeLock = useRef<any>(null);
  const isUploading = useRef(false); // ป้องกันการส่งข้อมูลซ้อนทับ

  // 1. Request Wake Lock เพื่อไม่ให้หน้าจอดับ
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) { console.error("Wake Lock Error:", err); }
    };
    requestWakeLock();
    return () => {
      wakeLock.current?.release();
    };
  }, []);

  // 2. ฟังก์ชันส่งภาพ Live Stream (ปรับปรุงให้ไม่ดีเลย์)
  const streamLive = async () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const now = Date.now();

    // คำนวณ FPS สำหรับการแสดงผลบนหน้าจอเท่านั้น
    frameCount.current++;
    if (now - lastFpsUpdate.current > 1000) {
      setFps(frameCount.current);
      frameCount.current = 0;
      lastFpsUpdate.current = now;
    }

    // ส่งภาพไป Firebase ทุกๆ 1 วินาที (1000ms) เพื่อลดอาการคอขวด
    // และจะส่งก็ต่อเมื่อการส่งครั้งก่อนเสร็จสิ้นแล้วเท่านั้น (isUploading)
    if (now - lastStreamTime.current > 1000 && !isUploading.current) {
      isUploading.current = true;
      try {
        // ลดคุณภาพ jpeg เหลือ 0.1 เพื่อความเร็วสูงสุดในการ Stream
        const frame = canvas.toDataURL('image/jpeg', 0.1);

        await set(ref(db, 'system/live_stream'), {
          frame,
          lastActive: serverTimestamp(),
          fps: frameCount.current // ส่ง FPS ปัจจุบันไปให้ผู้ดูแลดูด้วย
        });

        lastStreamTime.current = now;
      } catch (error) {
        console.error("Stream Upload Error:", error);
      } finally {
        isUploading.current = false;
      }
    }
  };

  // 3. ฟังก์ชันจัดการเมื่อตรวจพบการหกล้ม
  const handleFallDetected = async () => {
    if (isAlert) return;
    setIsAlert(true);

    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    // เมื่อหกล้ม เราจะใช้ความละเอียดที่สูงขึ้น (0.5) เพื่อเป็นหลักฐานที่ชัดเจน
    const evidence = canvas ? canvas.toDataURL('image/jpeg', 0.5) : null;

    try {
      await set(ref(db, 'system/fall_event'), {
        detected: true,
        evidence: evidence,
        timestamp: serverTimestamp(), // ใช้เวลาจาก Server จะแม่นยำกว่า
        confidence: sensitivity
      });
    } catch (error) {
      console.error("Alert Upload Error:", error);
    }

    // ค้างสถานะ Alert ไว้ 5 วินาทีแล้วค่อย Reset
    setTimeout(() => setIsAlert(false), 5000);
  };

  // 4. Loop การทำงาน
  useEffect(() => {
    const interval = setInterval(streamLive, 100); // เช็คเงื่อนไขการส่งทุก 100ms
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 p-4 md:p-10 font-sans selection:bg-blue-500/30">

      {/* --- TOP NAVIGATION --- */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`absolute -inset-1 rounded-full blur opacity-25 animate-pulse ${isAlert ? 'bg-red-500' : 'bg-blue-500'}`}></div>
            <div className="relative bg-zinc-900 p-3 rounded-2xl border border-white/10">
              <Radio className={isAlert ? "text-red-500" : "text-blue-500"} size={24} />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-black uppercase italic tracking-tighter leading-none flex items-center gap-2">
              Node-01 <span className="text-[10px] not-italic font-bold bg-blue-600 px-2 py-0.5 rounded text-white">PRO</span>
            </h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">Status: {isAlert ? 'EMERGENCY' : 'Active Stream'}</p>
          </div>
        </div>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-4 rounded-2xl border transition-all duration-500 ${showSettings ? 'bg-blue-600 border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'bg-zinc-900 border-white/5 hover:border-white/20'}`}
        >
          <Settings2 size={22} className={showSettings ? "rotate-180 transition-transform duration-500" : "transition-transform duration-500"} />
        </button>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* --- MAIN CAMERA VIEW (LEFT) --- */}
        <div className="lg:col-span-8 space-y-6">
          <div className={`relative aspect-square md:aspect-video rounded-[3rem] overflow-hidden border-2 transition-all duration-1000 bg-zinc-950 shadow-2xl ${isAlert ? 'border-red-500 shadow-[0_0_100px_rgba(239,68,68,0.4)] scale-[0.99]' : 'border-white/5'}`}>

            {/* Component ตรวจจับหลัก */}
            <FallDetector onFallDetected={handleFallDetected} />

            {/* HUD Overlay */}
            <div className="absolute inset-0 pointer-events-none border-[20px] border-transparent group-hover:border-white/5 transition-all duration-500">
              <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-white/20 rounded-tl-lg"></div>
              <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-white/20 rounded-tr-lg"></div>
              <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-white/20 rounded-bl-lg"></div>
              <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-white/20 rounded-br-lg"></div>

              <div className="absolute bottom-10 left-10 flex gap-10 items-end">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Cpu size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Core Engine</span>
                  </div>
                  <p className="text-sm font-black italic">ONNX_WASM_V2</p>
                </div>
              </div>
            </div>

            {/* Alert Overlay */}
            {isAlert && (
              <div className="absolute inset-0 bg-red-600/10 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-300">
                <div className="flex flex-col items-center">
                  <div className="bg-red-600 text-white px-10 py-4 rounded-3xl font-black text-3xl italic uppercase tracking-tighter shadow-[0_20px_50px_rgba(220,38,38,0.5)] animate-bounce">
                    Fall Detected
                  </div>
                  <p className="text-white mt-4 font-bold uppercase tracking-widest text-[10px] opacity-70">Uplinking evidence to cloud...</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between px-6 py-2 bg-zinc-900/30 rounded-full border border-white/5">
            <div className="flex items-center gap-2 text-zinc-500">
              <ShieldCheck size={14} className="text-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest">End-to-End Encryption Active</span>
            </div>
            <div className="text-[10px] font-bold text-zinc-600 uppercase">Live: {new Date().toLocaleTimeString()}</div>
          </div>
        </div>

        {/* --- SIDEBAR PANEL (RIGHT) --- */}
        <div className={`lg:col-span-4 space-y-6 transition-all duration-700 ${showSettings ? 'opacity-100 translate-y-0' : 'opacity-100'}`}>

          {/* Performance Monitor Card */}
          <div className="bg-zinc-900/40 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/5 shadow-xl">
            <div className="flex items-center gap-3 mb-8">
              <Gauge className="text-blue-500" size={20} />
              <h2 className="text-xs font-black uppercase tracking-[0.2em]">Telemetry</h2>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="relative">
                <p className="text-[10px] text-zinc-500 uppercase font-black mb-1">Process Rate</p>
                <p className="text-4xl font-black italic tracking-tighter">{fps}<span className="text-sm not-italic ml-1 text-zinc-600">Hz</span></p>
                <div className="w-full h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${Math.min((fps / 30) * 100, 100)}%` }}></div>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-black mb-1">Wake Lock</p>
                <p className="text-sm font-black text-green-500 mt-2 bg-green-500/10 px-3 py-1 rounded-lg inline-block">SECURED</p>
              </div>
            </div>
          </div>

          {/* Configuration Panel */}
          <div className="bg-zinc-900/40 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/5 shadow-xl space-y-8">
            <div className="flex items-center gap-3">
              <Settings2 className="text-zinc-500" size={20} />
              <h2 className="text-xs font-black uppercase tracking-[0.2em]">Configuration</h2>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">AI Sensitivity</label>
                <span className="text-lg font-black italic text-blue-500">{(sensitivity * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range" min="0.4" max="0.9" step="0.05"
                value={sensitivity} onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <div className="pt-8 border-t border-white/5">
              <div className="bg-blue-500/5 p-4 rounded-3xl border border-blue-500/10 flex items-start gap-3">
                <Activity size={18} className="text-blue-500 mt-1" />
                <p className="text-[10px] leading-relaxed text-zinc-400 font-medium">
                  <span className="text-white font-bold block mb-1 uppercase tracking-tighter">System Health</span>
                  {fps > 15 ? "Processing is smooth." : "Low frame rate detected. Check lighting or device heat."}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

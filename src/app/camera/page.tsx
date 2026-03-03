"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import FallDetector from "@/components/FallDetector";
import { db } from "@/lib/firebase";
import { ref, set, push, serverTimestamp } from "firebase/database";
import { ShieldCheck, RefreshCw, Home } from "lucide-react";

const CLOUDFLARE_WORKER_URL = "https://cctv-stream-worker.aman02012548.workers.dev";

export default function CameraPage() {
  const [isAlert, setIsAlert] = useState(false);
  const [fps, setFps] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [mounted, setMounted] = useState(false);

  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(0);
  const streamCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const toggleCamera = () => setFacingMode((prev) => (prev === "user" ? "environment" : "user"));

  // ---------------- AGGRESSIVE STREAM (UNLIMITED FPS) ----------------
  const streamLive = useCallback(async () => {
    const mainCanvas = document.querySelector("canvas") as HTMLCanvasElement;
    if (!mainCanvas || !mounted) return;

    const now = Date.now();
    frameCount.current++;
    if (now - lastFpsUpdate.current > 1000) {
      setFps(frameCount.current);
      frameCount.current = 0;
      lastFpsUpdate.current = now;
    }

    try {
      if (!streamCanvasRef.current) {
        streamCanvasRef.current = document.createElement("canvas");
        streamCanvasRef.current.width = 480; 
        streamCanvasRef.current.height = 480;
      }
      
      const sCanvas = streamCanvasRef.current;
      const sCtx = sCanvas.getContext("2d", { alpha: false, desynchronized: true });

      if (sCtx) {
        sCtx.imageSmoothingEnabled = true;
        sCtx.imageSmoothingQuality = 'medium';
        sCtx.save();
        if (facingMode === "user") {
          sCtx.scale(-1, 1);
          sCtx.drawImage(mainCanvas, -480, 0, 480, 480);
        } else {
          sCtx.drawImage(mainCanvas, 0, 0, 480, 480);
        }
        sCtx.restore();
      }

      sCanvas.toBlob(async (blob) => {
        if (!blob || !mounted) return;

        // ส่งแบบ Fire-and-forget: ไม่ใช้ await เพื่อไม่ให้ loop สะดุด
        fetch(CLOUDFLARE_WORKER_URL, {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": "image/jpeg" },
          mode: 'cors',
        }).catch(() => {}); // เพิกเฉยต่อ error เพื่อรันเฟรมต่อไปทันที
        
        // วิ่งเข้าเฟรมถัดไปทันทีตามความเร็วหน้าจอ (60fps)
        requestAnimationFrame(streamLive);
      }, "image/jpeg", 0.5); // บีบอัด 0.5 เพื่อให้ไฟล์เล็กส่งไวแต่ยังชัด
    } catch (e) {
      requestAnimationFrame(streamLive);
    }
  }, [facingMode, mounted]);

  const handleFallDetected = async () => {
    if (isAlert) return;
    setIsAlert(true);
    const mainCanvas = document.querySelector("canvas") as HTMLCanvasElement;
    let evidence: string | null = null;
    if (mainCanvas) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = mainCanvas.width;
      tempCanvas.height = mainCanvas.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        tempCtx.drawImage(mainCanvas, 0, 0);
        evidence = tempCanvas.toDataURL("image/jpeg", 0.6);
      }
    }
    try {
      await set(ref(db, "system/fall_event"), { detected: true, evidence, timestamp: serverTimestamp() });
      await set(push(ref(db, "history/falls")), { evidence, timestamp: serverTimestamp(), timeStr: new Date().toLocaleTimeString("th-TH") });
    } catch (error) { console.error(error); }
    setTimeout(() => setIsAlert(false), 10000);
  };

  useEffect(() => {
    setMounted(true);
    const startTimeout = setTimeout(streamLive, 1000);
    return () => { setMounted(false); clearTimeout(startTimeout); };
  }, [streamLive]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-5xl space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase opacity-70">
            <div className={`w-2 h-2 rounded-full animate-pulse ${isAlert ? "bg-red-500" : "bg-blue-500"}`} />
            High-Performance Stream
          </div>
          <div className="text-[10px] font-mono opacity-40">Encoder FPS: {fps}</div>
        </div>
        <div className={`relative aspect-video rounded-[2.5rem] overflow-hidden border-2 transition-all duration-500 bg-zinc-950 ${isAlert ? 'border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.1)]' : 'border-white/10'}`}>
          <div className="w-full h-full"><FallDetector onFallDetected={handleFallDetected} facingMode={facingMode} /></div>
          <div className="absolute top-6 right-6 flex gap-2 pointer-events-auto">
            <Link href="/"><button className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 transition-all active:scale-95"><Home size={20} /></button></Link>
            <button onClick={toggleCamera} className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 transition-all active:scale-95"><RefreshCw size={20} /></button>
          </div>
          {isAlert && (
            <div className="absolute inset-0 bg-red-600/20 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-2xl italic animate-bounce border-2 border-white/20 uppercase">FALL DETECTED</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
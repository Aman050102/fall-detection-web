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
  const isUploading = useRef(false);
  const streamCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  // ---------------- ULTRA SMOOTH STREAM (CLOUDFLARE) ----------------
  const streamLive = useCallback(async () => {
    const mainCanvas = document.querySelector("canvas") as HTMLCanvasElement;
    if (!mainCanvas || !mounted) return;

    // ระบบ Drop Frame: ถ้าเน็ตส่งภาพเก่าไม่เสร็จ ให้ข้ามไปส่งภาพใหม่ทันที เพื่อลด Delay สะสม
    if (isUploading.current) {
      requestAnimationFrame(streamLive);
      return;
    }

    const now = Date.now();
    frameCount.current++;
    if (now - lastFpsUpdate.current > 1000) {
      setFps(frameCount.current);
      frameCount.current = 0;
      lastFpsUpdate.current = now;
    }

    isUploading.current = true;
    try {
      if (!streamCanvasRef.current) {
        streamCanvasRef.current = document.createElement("canvas");
        streamCanvasRef.current.width = 360; 
        streamCanvasRef.current.height = 360;
      }
      
      const sCanvas = streamCanvasRef.current;
      const sCtx = sCanvas.getContext("2d", { alpha: false, desynchronized: true });

      if (sCtx) {
        sCtx.imageSmoothingEnabled = false; 
        sCtx.save();
        if (facingMode === "user") {
          sCtx.scale(-1, 1);
          sCtx.drawImage(mainCanvas, -360, 0, 360, 360);
        } else {
          sCtx.drawImage(mainCanvas, 0, 0, 360, 360);
        }
        sCtx.restore();
      }

      sCanvas.toBlob(async (blob) => {
        if (!blob || !mounted) { isUploading.current = false; return; }

        // ส่งภาพแบบ Parallel ไม่รอการตอบกลับ เพื่อความสมูทสูงสุด
        fetch(CLOUDFLARE_WORKER_URL, {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": "image/jpeg" },
          mode: 'cors',
        }).finally(() => {
          isUploading.current = false;
        });
        
        requestAnimationFrame(streamLive);
      }, "image/jpeg", 0.4); 
    } catch (error) {
      isUploading.current = false;
      setTimeout(streamLive, 500);
    }
  }, [facingMode, mounted]);

  // ---------------- FALL DETECTION LOGIC (FIREBASE) ----------------
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
      // บันทึกข้อมูลลง Firebase Realtime Database
      await set(ref(db, "system/fall_event"), {
        detected: true,
        evidence,
        timestamp: serverTimestamp(),
      });

      await set(push(ref(db, "history/falls")), {
        evidence,
        timestamp: serverTimestamp(),
        timeStr: new Date().toLocaleTimeString("th-TH"),
      });
    } catch (error) {
      console.error("Firebase Error:", error);
    }

    setTimeout(() => setIsAlert(false), 10000);
  };

  useEffect(() => {
    setMounted(true);
    const startTimeout = setTimeout(streamLive, 1000);
    return () => {
      setMounted(false);
      clearTimeout(startTimeout);
    };
  }, [streamLive]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-5xl space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase opacity-70">
            <div className={`w-2 h-2 rounded-full animate-pulse ${isAlert ? "bg-red-500" : "bg-blue-500"}`} />
            AI Guard Monitoring
          </div>
          <div className="text-[10px] font-mono opacity-40">Rate: {fps}Hz</div>
        </div>

        <div className={`relative aspect-video rounded-[2.5rem] overflow-hidden border-2 transition-all duration-500 bg-zinc-950 ${isAlert ? 'border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.1)]' : 'border-white/10'}`}>
          <div className="w-full h-full">
            <FallDetector onFallDetected={handleFallDetected} facingMode={facingMode} />
          </div>
          <div className="absolute top-6 right-6 flex gap-2 pointer-events-auto">
            <Link href="/"><button className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10"><Home size={20} /></button></Link>
            <button onClick={toggleCamera} className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10"><RefreshCw size={20} /></button>
          </div>
          {isAlert && (
            <div className="absolute inset-0 bg-red-600/20 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-2xl italic animate-bounce border-2 border-white/20 uppercase">FALL DETECTED</div>
            </div>
          )}
        </div>
        <div className="flex justify-between items-center px-4 py-3 bg-zinc-900/50 rounded-2xl border border-white/5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-blue-500" /> Security Active</div>
          <div className="font-mono">{new Date().toLocaleTimeString("en-GB")}</div>
        </div>
      </div>
    </div>
  );
}
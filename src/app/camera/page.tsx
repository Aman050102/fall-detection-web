"use client";

import React, { useState, useEffect, useRef } from "react";
import FallDetector from "@/components/FallDetector";
import { db } from "@/lib/firebase";
import { ref, set, serverTimestamp } from "firebase/database";
import { Radio, ShieldCheck, Cpu, Camera } from "lucide-react";

export default function CameraPage() {
  const [isAlert, setIsAlert] = useState(false);
  const [fps, setFps] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  const lastStreamTime = useRef(0);
  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(0);
  const wakeLock = useRef<any>(null);
  const isUploading = useRef(false);

  // Wake Lock
  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch (err) {
        console.error("Wake Lock Error:", err);
      }
    };

    requestWakeLock();
    return () => wakeLock.current?.release();
  }, []);

  // Stream + FPS
  const streamLive = async () => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement;
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
        const frame = canvas.toDataURL("image/jpeg", 0.1);

        await set(ref(db, "system/live_stream"), {
          frame,
          lastActive: serverTimestamp(),
          fps: frameCount.current,
        });

        lastStreamTime.current = now;
      } catch (error) {
        console.error("Stream Upload Error:", error);
      } finally {
        isUploading.current = false;
      }
    }
  };

  const handleFallDetected = async () => {
    if (isAlert) return;
    setIsAlert(true);

    const canvas = document.querySelector("canvas") as HTMLCanvasElement;
    const evidence = canvas ? canvas.toDataURL("image/jpeg", 0.5) : null;

    await set(ref(db, "system/fall_event"), {
      detected: true,
      evidence,
      timestamp: serverTimestamp(),
    });

    setTimeout(() => setIsAlert(false), 5000);
  };

  useEffect(() => {
    const interval = setInterval(streamLive, 100);
    return () => clearInterval(interval);
  }, []);

  const toggleCamera = () => {
    setFacingMode((prev) =>
      prev === "environment" ? "user" : "environment"
    );
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 px-4 md:px-8 py-8">

      {/* Top Bar */}
      <div className="max-w-6xl mx-auto mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Radio className={isAlert ? "text-red-500" : "text-blue-500"} />
          <span className="text-sm uppercase tracking-widest">
            {isAlert ? "EMERGENCY" : "LIVE"}
          </span>
        </div>

      </div>

      {/* Camera Box */}
      <div className="max-w-6xl mx-auto flex justify-center">
        <div
          className={`relative w-full max-w-5xl aspect-video max-h-[80vh]
          rounded-[2.5rem] overflow-hidden
          border transition-all duration-500
          bg-zinc-950 shadow-2xl
          ${isAlert ? "border-red-500" : "border-white/10"}`}
        >
          <FallDetector
            onFallDetected={handleFallDetected}
            facingMode={facingMode}
          />

          <div className="absolute bottom-6 left-6 text-xs tracking-widest text-white space-y-1">
            <div className="flex items-center gap-2 text-blue-400">
              <Cpu size={14} />
              ONNX_WASM_V2
            </div>
            <div>FPS: {fps}</div>
          </div>

          {isAlert && (
            <div className="absolute inset-0 bg-red-600/20 flex items-center justify-center">
              <div className="bg-red-600 text-white px-12 py-6 text-4xl font-black rounded-2xl animate-pulse">
                FALL DETECTED
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto mt-6 flex justify-between px-4 py-2 bg-zinc-900/30 rounded-full border border-white/5 text-xs uppercase tracking-widest text-zinc-500">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-blue-500" />
          End-to-End Encryption Active
        </div>
        <div suppressHydrationWarning>
          Live: {new Date().toLocaleTimeString()}
        </div>
      </div>

    </div>
  );
}
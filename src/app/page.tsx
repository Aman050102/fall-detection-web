"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Camera, AlertTriangle, ShieldCheck } from 'lucide-react';
import Script from 'next/script';

export default function FallDetectionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cvLoaded, setCvLoaded] = useState(false);
  const [isFalling, setIsFalling] = useState(false);

  // 1. ฟังก์ชันโหลดกล้อง
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied:", err);
    }
  };

  // 2. ฟังก์ชันสั่น (Vibration)
  const triggerAlert = () => {
    setIsFalling(true);
    if ("vibrate" in navigator) {
      navigator.vibrate([500, 100, 500]); // สั่น 500ms หยุด 100ms สั่น 500ms
    }
    // ปิด Alert หลังจาก 3 วินาที
    setTimeout(() => setIsFalling(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* โหลด OpenCV.js จาก public/opencv/opencv.js */}
      <Script
        src="/opencv/opencv.js"
        onLoad={() => {
          console.log("OpenCV.js Loaded Successfully");
          setCvLoaded(true);
        }}
      />

      <header className="max-w-5xl mx-auto mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="text-blue-500" />
            ระบบตรวจจับการล้ม AI
          </h1>
          <p className="text-slate-400 text-sm">OpenCV.js + Next.js (TypeScript)</p>
        </div>
        <div className={`px-4 py-1 rounded-full text-xs font-bold ${cvLoaded ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
          {cvLoaded ? "● OpenCV Ready" : "○ Loading OpenCV..."}
        </div>
      </header>

      <main className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ส่วนแสดงผลกล้อง */}
        <div className="lg:col-span-2 relative bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-auto"
          />
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />

          {isFalling && (
            <div className="absolute inset-0 bg-red-600/40 flex flex-col items-center justify-center animate-pulse">
              <AlertTriangle size={80} className="text-white mb-4" />
              <h2 className="text-4xl font-black text-white italic">DETECTED FALLING!</h2>
            </div>
          )}
        </div>

        {/* ส่วนควบคุมและประวัติ */}
        <div className="flex flex-col gap-6">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-semibold mb-4">เมนูควบคุม</h3>
            <button
              onClick={startCamera}
              className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
            >
              <Camera size={20} /> เปิดกล้องภายนอก
            </button>
            <button
              onClick={triggerAlert}
              className="w-full mt-3 bg-slate-800 hover:bg-slate-700 py-3 rounded-xl font-bold transition-all"
            >
              ทดสอบระบบสั่น & แจ้งเตือน
            </button>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex-grow">
            <h3 className="text-lg font-semibold mb-4 text-slate-400">ประวัติการตรวจพบ</h3>
            <div className="text-sm text-slate-500 italic text-center py-10">
              ยังไม่พบเหตุการณ์ผิดปกติ
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

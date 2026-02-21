"use client";
import { useEffect, useRef, useState } from 'react';

export default function FallDetectionPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFalling, setIsFalling] = useState(false);

  // ฟังก์ชันสั่งสั่นมือถือ
  const triggerVibration = () => {
    if ("vibrate" in navigator) {
      navigator.vibrate([500, 200, 500]); // สั่น 0.5 วิ, หยุด 0.2 วิ, สั่น 0.5 วิ
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  return (
    <main className="flex flex-col items-center p-8 bg-slate-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-6">Fall Detection System</h1>

      <div className="relative rounded-lg overflow-hidden border-4 border-slate-700">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full max-w-2xl bg-black"
        />
        {isFalling && (
          <div className="absolute inset-0 bg-red-600/50 flex items-center justify-center animate-pulse">
            <span className="text-4xl font-black">DETECTED FALLING!</span>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-4">
        <button
          onClick={startCamera}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-full font-semibold"
        >
          Start Camera
        </button>
        <button
          onClick={() => {
            setIsFalling(!isFalling);
            if(!isFalling) triggerVibration();
          }}
          className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded-full font-semibold"
        >
          Test Alert & Vibrate
        </button>
      </div>
    </main>
  );
}

"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';

interface FallDetectorProps {
  onFallDetected: () => void;
}

export default function FallDetector({ onFallDetected }: FallDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [session, setSession] = useState<ort.InferenceSession | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. โหลดโมเดล ONNX จาก public/model/best.onnx
  useEffect(() => {
    const loadModel = async () => {
      try {
        const sess = await ort.InferenceSession.create('/model/best.onnx', {
          executionProviders: ['webgl'], // ใช้ GPU ของ Browser
        });
        setSession(sess);
        setLoading(false);
        console.log("AI Model Loaded Successfully!");
      } catch (e) {
        console.error("Failed to load model:", e);
      }
    };
    loadModel();
    startCamera();
  }, []);

  // 2. ฟังก์ชันเปิดกล้อง (บังคับกล้องหลังสำหรับมือถือ)
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // ใช้กล้องหลัง
          width: 640,
          height: 640
        }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  // 3. ฟังก์ชันประมวลผล AI ในทุกๆ เฟรม
  useEffect(() => {
    if (!session || !videoRef.current) return;

    const detect = async () => {
      if (videoRef.current?.paused || videoRef.current?.ended) return;

      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // ปรับขนาด Canvas ให้เท่ากับวิดีโอ
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // วาดภาพจากวิดีโอลง canvas (Hidden) เพื่อนำไปเข้า AI
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // ดึงข้อมูล Pixel และทำการ Normalize (Preprocessing)
      // หมายเหตุ: โค้ดส่วนนี้เป็นแบบย่อ คุณอาจต้องปรับสเกลข้อมูลให้ตรงกับที่ YOLO ต้องการ

      // สมมติผลลัพธ์จากการรันโมเดล (Dummy Inference)
      // ในงานจริงต้องใช้: const output = await session.run({ images: inputTensor });

      requestAnimationFrame(detect);
    };

    detect();
  }, [session]);

  return (
    <div className="relative w-full h-full bg-black">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-blue-400 font-medium">กำลังเตรียมสมอง AI...</p>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Canvas สำหรับวาดกรอบ Bounding Box */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />

      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white">Live AI Processing</span>
      </div>
    </div>
  );
}

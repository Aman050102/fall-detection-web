"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';

// 1. ตั้งค่า Path สำหรับไฟล์ WASM
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
ort.env.logLevel = 'error';

interface FallDetectorProps {
  onFallDetected: () => void;
  facingMode?: 'user' | 'environment';
}

export default function FallDetector({ onFallDetected, facingMode = 'environment' }: FallDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const requestRef = useRef<number | undefined>(undefined);

  const fallCounter = useRef(0);
  const [loading, setLoading] = useState(true);
  const [cameraName, setCameraName] = useState<string>("กำลังค้นหากล้อง...");
  const [error, setError] = useState<string | null>(null);

  // 2. โหลด Model AI แบบบังคับ Single Thread เพื่อแก้ปัญหาจอเขียวจาก SharedArrayBuffer
  useEffect(() => {
    const initAI = async () => {
      try {
        const sess = await ort.InferenceSession.create('/model/best.onnx', {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
          // ✅ ส่วนสำคัญ: ป้องกันเบราว์เซอร์บล็อกพิกเซลจนจอเขียว
          enableCpuMemAccessRaw: true,
          extra: { session: { num_threads: 1 } }
        });
        sessionRef.current = sess;
        setLoading(false);
      } catch (e) {
        console.error("AI Initialization Error:", e);
        setError("ไม่สามารถโหลดระบบ AI ได้");
      }
    };
    initAI();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (!loading) startCamera();
  }, [facingMode, loading]);

  const stopCamera = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const startCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 640 },
          aspectRatio: 1
        }
      });
      setCameraName(stream.getVideoTracks()[0].label || "Active Camera");

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          requestRef.current = requestAnimationFrame(detect);
        };
      }
    } catch (err) {
      console.error("Camera Access Error:", err);
      setError("ไม่สามารถเข้าถึงกล้องได้");
    }
  };

  const detect = async () => {
    if (!videoRef.current || !sessionRef.current || !canvasRef.current || videoRef.current.paused) {
      requestRef.current = requestAnimationFrame(detect);
      return;
    }

    const canvas = canvasRef.current;
    // ✅ ใช้ willReadFrequently และ alpha: false เพื่อความเร็วและแก้ปัญหาการจัดการหน่วยความจำ
    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
    if (!ctx) return;

    // 3. วาดภาพจริงลง Canvas (ล้างพิกเซลสีเขียวทิ้งทุกเฟรมด้วยพื้นหลังดำ)
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 640, 640);
    ctx.drawImage(videoRef.current, 0, 0, 640, 640);

    // 4. เตรียมข้อมูล Tensor
    const imgData = ctx.getImageData(0, 0, 640, 640);
    const pixels = imgData.data;
    const input = new Float32Array(3 * 640 * 640);
    for (let i = 0; i < 640 * 640; i++) {
      input[i] = pixels[i * 4] / 255;           // R
      input[i + 640 * 640] = pixels[i * 4 + 1] / 255;   // G
      input[i + 2 * 640 * 640] = pixels[i * 4 + 2] / 255; // B
    }

    try {
      const inputTensor = new ort.Tensor('float32', input, [1, 3, 640, 640]);
      const output = await sessionRef.current.run({ images: inputTensor });
      const data = output.output0.data as Float32Array;

      let foundFallInFrame = false;

      // 5. ลูปวาดกรอบสิ่งมีชีวิต (คน/สัตว์) และการล้ม
      for (let i = 0; i < 8400; i++) {
        const personScore = data[0 * 8400 + i];
        const animalScore = data[1 * 8400 + i];
        const fallScore = data[4 * 8400 + i];

        if (personScore > 0.45 || animalScore > 0.45 || fallScore > 0.5) {
          const x = data[0 * 8400 + i], y = data[1 * 8400 + i], w = data[2 * 8400 + i], h = data[3 * 8400 + i];

          ctx.beginPath();
          if (fallScore > 0.70) {
            ctx.strokeStyle = "#FF3131"; // แดง: ล้ม
            ctx.lineWidth = 6;
            foundFallInFrame = true;
          } else {
            ctx.strokeStyle = "#00FF00"; // เขียว: สิ่งมีชีวิต
            ctx.lineWidth = 2;
          }
          ctx.strokeRect(x - w / 2, y - h / 2, w, h);

          ctx.fillStyle = ctx.strokeStyle;
          ctx.font = "bold 16px Arial";
          const label = fallScore > 0.70 ? "● FALLING" : (personScore > animalScore ? "● PERSON" : "● ANIMAL");
          ctx.fillText(label, x - w / 2, y - h / 2 - 10);
        }
      }

      if (foundFallInFrame) {
        fallCounter.current++;
        if (fallCounter.current >= 4) onFallDetected();
      } else {
        fallCounter.current = Math.max(0, fallCounter.current - 1);
      }
    } catch (e) {
      console.error("AI Detect Error:", e);
    }

    requestRef.current = requestAnimationFrame(detect);
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden rounded-[2rem] border border-white/10">
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas ref={canvasRef} width={640} height={640} className="w-full h-full object-contain" />
      
      {!loading && !error && (
        <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <p className="text-[11px] text-white font-medium uppercase tracking-wider">{cameraName}</p>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center z-10">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-blue-500 font-bold animate-pulse text-xs uppercase tracking-widest">AI INITIALIZING...</p>
        </div>
      )}
    </div>
  );
}
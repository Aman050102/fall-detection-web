"use client";
import React, { useEffect, useRef, useState } from "react";
import * as ort from "onnxruntime-web";

ort.env.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";
ort.env.logLevel = "error";

interface FallDetectorProps {
  onFallDetected: () => void;
  facingMode?: "user" | "environment";
}

export default function FallDetector({
  onFallDetected,
  facingMode = "environment",
}: FallDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const requestRef = useRef<number | null>(null);
  const fallCounter = useRef(0);

  // --- ส่วนที่เพิ่มเข้ามา: สำหรับตรวจจับ คน และ สัตว์ ---
  const [isObjectAiReady, setIsObjectAiReady] = useState(false);
  const cocoSsdModelRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const size = 640;

  // ฟังก์ชันโหลด Script ภายนอกเพื่อป้องกัน Build Error (Module not found)
  const loadExternalAiScripts = () => {
    return new Promise((resolve) => {
      if ((window as any).cocoSsd) {
        resolve(true);
        return;
      }
      const tfjs = document.createElement("script");
      tfjs.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs";
      tfjs.onload = () => {
        const coco = document.createElement("script");
        coco.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd";
        coco.onload = () => resolve(true);
        document.head.appendChild(coco);
      };
      document.head.appendChild(tfjs);
    });
  };

  useEffect(() => {
    const initAI = async () => {
      try {
        // 1. โหลดระบบ Fall Detection เดิม (ห้ามตัด)
        const sess = await ort.InferenceSession.create("/model/best.onnx", {
          executionProviders: ["wasm"],
        });
        sessionRef.current = sess;

        // 2. โหลดระบบตรวจจับ คน/สัตว์ เพิ่มเติม (ที่สั่งเพิ่ม)
        await loadExternalAiScripts();
        const model = await (window as any).cocoSsd.load();
        cocoSsdModelRef.current = model;
        setIsObjectAiReady(true);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError("ไม่สามารถโหลดระบบ AI ได้");
      }
    };
    initAI();
    return () => {
      stopCamera();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  useEffect(() => {
    if (!loading) startCamera();
  }, [facingMode, loading]);

  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: size }, height: { ideal: size }, aspectRatio: 1 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          if (!requestRef.current) requestRef.current = requestAnimationFrame(detect);
        };
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("ไม่สามารถเข้าถึงกล้องได้");
    }
  };

  const detect = async () => {
    if (!videoRef.current || !canvasRef.current || !sessionRef.current || videoRef.current.paused) {
      requestRef.current = requestAnimationFrame(detect);
      return;
    }

    const ctx = canvasRef.current.getContext("2d", {
      willReadFrequently: true,
    });
    if (!ctx) return;

    // 1️⃣ เตรียมข้อมูลภาพ (เหมือนเดิม)
    ctx.drawImage(videoRef.current, 0, 0, size, size);
    const imgData = ctx.getImageData(0, 0, size, size).data;

    const input = new Float32Array(3 * size * size);
    for (let i = 0; i < size * size; i++) {
      input[i] = imgData[i * 4] / 255;
      input[i + size * size] = imgData[i * 4 + 1] / 255;
      input[i + 2 * size * size] = imgData[i * 4 + 2] / 255;
    }

    try {
      // รัน AI ทั้งคู่ขนานกัน
      const [output, objectPredictions] = await Promise.all([
        sessionRef.current.run({ images: new ort.Tensor("float32", input, [1, 3, size, size]) }),
        isObjectAiReady ? cocoSsdModelRef.current.detect(videoRef.current) : []
      ]);

      const data = output.output0.data as Float32Array;
      let foundFallInFrame = false;

      // --- ตรวจเช็คว่ามี "คนยืน" หรือไม่ (เพื่อยับยั้ง False Positive) ---
      const isSomeoneStanding = objectPredictions.some((p: any) => {
        if (p.class === 'person' && p.score > 0.6) {
          const [,, w, h] = p.bbox;
          return h > w * 1.2; // ถ้าสูงกว่ากว้าง 1.2 เท่า ถือว่า "ยืนอยู่"
        }
        return false;
      });

      // 2️⃣ แสดงผล Mirror และวาดกรอบ
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      if (facingMode === "user") {
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, -size, 0, size, size);
      } else {
        ctx.drawImage(videoRef.current, 0, 0, size, size);
      }
      ctx.restore();

      // --- วาดกรอบตรวจจับการล้ม (ปรับปรุง Logic) ---
      for (let i = 0; i < 8400; i++) {
        const confidence = data[4 * 8400 + i];
        if (confidence > 0.85) { // เพิ่มความมั่นใจเป็น 0.85
          const x = data[0 * 8400 + i];
          const y = data[1 * 8400 + i];
          const w = data[2 * 8400 + i];
          const h = data[3 * 8400 + i];

          // เช็คสัดส่วน: คนล้มต้องกว้างกว่าสูง
          if (w > h * 1.2) {
            ctx.strokeStyle = "#FF3131"; 
            ctx.lineWidth = 6;
            let drawX = facingMode === "user" ? size - x - w / 2 : x - w / 2;
            ctx.strokeRect(drawX, y - h / 2, w, h);
            foundFallInFrame = true;
            break;
          }
        }
      }

      // --- วาดกรอบ คน/สัตว์ (เหมือนเดิม) ---
      objectPredictions.forEach((pred: any) => {
        const [x, y, width, height] = pred.bbox;
        const label = pred.class;
        if (['person', 'dog', 'cat'].includes(label)) {
          ctx.strokeStyle = label === 'person' ? "#00FF00" : "#00FFFF";
          ctx.lineWidth = 3;
          let drawX = facingMode === "user" ? size - x - width : x;
          ctx.strokeRect(drawX, y, width, height);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.font = "bold 16px Arial";
          ctx.fillText(`${label.toUpperCase()}`, drawX, y > 20 ? y - 5 : 20);
        }
      });

      // 3️⃣ ตัดสินใจแจ้งเตือน (Decision Logic)
      if (foundFallInFrame && !isSomeoneStanding) {
        fallCounter.current += 1;
        // ปรับเป็น 10 เฟรม (~0.5 วินาที) เพื่อความชัวร์
        if (fallCounter.current >= 10) {
          onFallDetected();
          fallCounter.current = 0;
        }
      } else {
        // ถ้าไม่เจอ หรือมีคนยืนประคองอยู่ ให้ Reset เร็วขึ้น (ทีละ 2)
        fallCounter.current = Math.max(0, fallCounter.current - 2);
      }

    } catch (e) {
      console.error("Inference Error:", e);
    }

    requestRef.current = requestAnimationFrame(detect);
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="w-full h-full object-contain"
      />

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-md z-50">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white text-xs font-black tracking-widest animate-pulse uppercase">
            Initializing AI Security Core...
          </p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-red-500 text-sm font-bold p-6 text-center z-50">
          {error}
        </div>
      )}
    </div>
  );
}

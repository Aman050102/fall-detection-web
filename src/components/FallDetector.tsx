"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as ort from "onnxruntime-web";

if (typeof window !== "undefined") {
  (ort as any).env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";
}

interface FallDetectorProps {
  onFallDetected: () => void;
  facingMode?: "user" | "environment";
}

export default function FallDetector({ onFallDetected, facingMode = "environment" }: FallDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const requestRef = useRef<number | null>(null);
  const fallCounter = useRef(0);
  const frameCount = useRef(0);

  const [isObjectAiReady, setIsObjectAiReady] = useState(false);
  const cocoSsdModelRef = useRef<any>(null);
  const objectPredictionsRef = useRef<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const size = 640;
  const aiSize = 320; // ลดขนาดสำหรับการคำนวณ AI เพื่อเพิ่มความลื่น

  const stopCamera = useCallback(() => {
    if (requestRef.current !== null) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  const detect = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !sessionRef.current || videoRef.current.paused) {
      requestRef.current = requestAnimationFrame(detect);
      return;
    }

    const ctx = canvasRef.current.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // --- 1. วาดมอนิเตอร์ (ลำดับความสำคัญสูงสุด) ---
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    if (facingMode === "user") {
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, -size, 0, size, size);
    } else {
      ctx.drawImage(videoRef.current, 0, 0, size, size);
    }
    ctx.restore();

    // วาดกรอบค้างไว้ (เพื่อให้ UI ดูนิ่ง)
    objectPredictionsRef.current.forEach((p: any) => {
      if (["person", "dog", "cat"].includes(p.class)) {
        ctx.strokeStyle = p.class === "person" ? "#00FF00" : "#00FFFF";
        ctx.lineWidth = 2;
        let drawX = facingMode === "user" ? size - p.bbox[0] - p.bbox[2] : p.bbox[0];
        ctx.strokeRect(drawX, p.bbox[1], p.bbox[2], p.bbox[3]);
      }
    });

    // --- 2. กลไกประหยัดพลังงานขั้นสูง (AI รันแค่ 1 ใน 5 เฟรม) ---
    frameCount.current++;
    if (frameCount.current % 5 !== 0) {
      requestRef.current = requestAnimationFrame(detect);
      return;
    }

    try {
      // ใช้สลับกันทำงานเพื่อไม่ให้ Main Thread ค้าง
      if (frameCount.current % 10 === 0) {
        // ทำ Fall Detection (ONNX)
        // ใช้ Canvas เล็กในการดึงข้อมูลภาพเพื่อลดโหลด CPU
        const aiCanvas = document.createElement("canvas");
        aiCanvas.width = aiSize;
        aiCanvas.height = aiSize;
        const aiCtx = aiCanvas.getContext("2d");
        if (aiCtx) {
          aiCtx.drawImage(videoRef.current, 0, 0, aiSize, aiSize);
          const imgData = aiCtx.getImageData(0, 0, aiSize, aiSize).data;
          
          const input = new Float32Array(3 * aiSize * aiSize);
          for (let i = 0; i < aiSize * aiSize; i++) {
            input[i] = imgData[i * 4] / 255;
            input[i + aiSize * aiSize] = imgData[i * 4 + 1] / 255;
            input[i + 2 * aiSize * aiSize] = imgData[i * 4 + 2] / 255;
          }
          
          const inputTensor = new ort.Tensor("float32", input, [1, 3, aiSize, aiSize]);
          const output = await sessionRef.current.run({ images: inputTensor });
          const firstKey = Object.keys(output)[0];
          const data = output[firstKey].data as Float32Array;

          let foundFall = false;
          for (let i = 0; i < 8400; i++) {
            if (data[4 * 8400 + i] > 0.65) {
              const w = data[2 * 8400 + i];
              const h = data[3 * 8400 + i];
              if (w > h * 1.1) { foundFall = true; break; }
            }
          }

          if (foundFall) {
            fallCounter.current++;
            if (fallCounter.current >= 3) { onFallDetected(); fallCounter.current = 0; }
          } else {
            fallCounter.current = Math.max(0, fallCounter.current - 1);
          }
        }
      } else if (isObjectAiReady && cocoSsdModelRef.current) {
        // ทำ Object Detection (COCO-SSD)
        const preds = await cocoSsdModelRef.current.detect(videoRef.current);
        objectPredictionsRef.current = preds;
      }
    } catch (e) {}

    requestRef.current = requestAnimationFrame(detect);
  }, [facingMode, isObjectAiReady, onFallDetected]);

  const startCamera = useCallback(async () => {
    try {
      stopCamera();
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode, width: { ideal: size }, height: { ideal: size } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
          requestRef.current = requestAnimationFrame(detect);
        };
      }
    } catch { setError("Camera Error"); }
  }, [facingMode, stopCamera, detect]);

  useEffect(() => {
    const init = async () => {
      try {
        const [sess] = await Promise.all([
          ort.InferenceSession.create("/model/best.onnx", { executionProviders: ["wasm"] }),
          (async () => {
            if (!(window as any).tf) {
              const s1 = document.createElement("script"); 
              s1.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs"; 
              document.head.appendChild(s1);
              await new Promise(r => s1.onload = r);
              const s2 = document.createElement("script"); 
              s2.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd"; 
              document.head.appendChild(s2);
              await new Promise(r => s2.onload = r);
            }
            const model = await (window as any).cocoSsd.load();
            cocoSsdModelRef.current = model;
            setIsObjectAiReady(true);
          })()
        ]);
        sessionRef.current = sess;
        setLoading(false);
      } catch { setError("AI Load Error"); }
    };
    init();
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (!loading) startCamera();
  }, [loading, startCamera]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas ref={canvasRef} width={size} height={size} className="w-full h-full object-contain" />
      
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-md z-50">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white text-[10px] font-bold tracking-widest uppercase">Initializing Core...</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-red-500 text-[10px] font-bold p-4 text-center z-50">
          {error}
        </div>
      )}
    </div>
  );
}
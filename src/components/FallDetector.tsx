"use client";
import React, { useEffect, useRef, useState } from "react";
import * as ort from "onnxruntime-web";

ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";
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

  const [isObjectAiReady, setIsObjectAiReady] = useState(false);
  const cocoSsdModelRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const size = 640;

  const loadExternalAiScripts = () => {
    return new Promise((resolve) => {
      if ((window as any).cocoSsd) { resolve(true); return; }
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
        const sess = await ort.InferenceSession.create("/model/best.onnx", {
          executionProviders: ["wasm"],
        });
        sessionRef.current = sess;
        await loadExternalAiScripts();
        const model = await (window as any).cocoSsd.load();
        cocoSsdModelRef.current = model;
        setIsObjectAiReady(true);
        setLoading(false);
      } catch (e) { 
        console.error(e);
        setError("AI Load Error"); 
      }
    };
    initAI();
    return () => {
      stopCamera();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  useEffect(() => { if (!loading) startCamera(); }, [facingMode, loading]);

  const stopCamera = () => {
    if (requestRef.current) { cancelAnimationFrame(requestRef.current); requestRef.current = null; }
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
    } catch (err) { setError("Camera Error"); }
  };

  const detect = async () => {
    if (!videoRef.current || !canvasRef.current || !sessionRef.current || videoRef.current.paused) {
      requestRef.current = requestAnimationFrame(detect);
      return;
    }

    const ctx = canvasRef.current.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, size, size);
    const imgData = ctx.getImageData(0, 0, size, size).data;

    const input = new Float32Array(3 * size * size);
    for (let i = 0; i < size * size; i++) {
      input[i] = imgData[i * 4] / 255;
      input[i + size * size] = imgData[i * 4 + 1] / 255;
      input[i + 2 * size * size] = imgData[i * 4 + 2] / 255;
    }

    try {
      const inputTensor = new ort.Tensor("float32", input, [1, 3, size, size]);
      const [output, objectPredictions] = await Promise.all([
        sessionRef.current.run({ images: inputTensor }),
        isObjectAiReady ? cocoSsdModelRef.current.detect(videoRef.current) : []
      ]);

      const data = output.output0.data as Float32Array;
      let foundFallInFrame = false;

      // Veto Logic: ตรวจหาท่าทาง "ยืนตรง" ที่ชัดเจน
      const isStrongStand = objectPredictions.some((p: any) => {
        if (p.class === "person" && p.score > 0.75) {
          const [, , w, h] = p.bbox;
          return h > w * 1.5; 
        }
        return false;
      });

      // Canvas Rendering (Mirror Mode)
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      if (facingMode === "user") {
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, -size, 0, size, size);
      } else {
        ctx.drawImage(videoRef.current, 0, 0, size, size);
      }
      ctx.restore();

      // โมเดล Fall Detection (ONNX)
      const NUM_BOXES = 8400;
      const CONF_THRESHOLD = 0.65;

      for (let i = 0; i < NUM_BOXES; i++) {
        const confidence = data[4 * NUM_BOXES + i];
        if (confidence > CONF_THRESHOLD) {
          const x = data[0 * NUM_BOXES + i];
          const y = data[1 * NUM_BOXES + i];
          const w = data[2 * NUM_BOXES + i];
          const h = data[3 * NUM_BOXES + i];

          // กฎฟิสิกส์ของการล้ม: ร่างกายขนานพื้น (Width > Height)
          if (w > h * 1.1) {
            foundFallInFrame = true;
            ctx.strokeStyle = "#FF3131";
            ctx.lineWidth = 5;
            let drawX = facingMode === "user" ? size - x - w / 2 : x - w / 2;
            ctx.strokeRect(drawX, y - h / 2, w, h);
            break; 
          }
        }
      }

      // วาดกรอบ COCO-SSD (Person/Pet)
      objectPredictions.forEach((p: any) => {
        if (["person", "dog", "cat"].includes(p.class)) {
          ctx.strokeStyle = p.class === "person" ? "#00FF00" : "#00FFFF";
          ctx.lineWidth = 2;
          let drawX = facingMode === "user" ? size - p.bbox[0] - p.bbox[2] : p.bbox[0];
          ctx.strokeRect(drawX, p.bbox[1], p.bbox[2], p.bbox[3]);
        }
      });

      // Decision Bridge
      if (foundFallInFrame && !isStrongStand) {
        fallCounter.current += 1;
        if (fallCounter.current >= 6) {
          onFallDetected();
          fallCounter.current = 0;
        }
      } else {
        // ลด Counter ลงทีละ 1 หากไม่พบสถานการณ์เสี่ยง
        fallCounter.current = Math.max(0, fallCounter.current - 1);
      }
    } catch (e) { console.error("Inference Error:", e); }

    requestRef.current = requestAnimationFrame(detect);
  };

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
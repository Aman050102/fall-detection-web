"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';
import { RefreshCw, Loader2 } from 'lucide-react';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

interface FallDetectorProps {
  onFallDetected: () => void;
  sensitivity?: number; // รับค่าจากหน้าหลักมาใช้
}

export default function FallDetector({ onFallDetected, sensitivity = 0.65 }: FallDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const isProcessing = useRef(false);
  const fallCounter = useRef(0); // ตัวนับเฟรมที่ตรวจเจอการล้ม

  const [loading, setLoading] = useState(true);
  const [cameraName, setCameraName] = useState<string>("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  useEffect(() => {
    const initAI = async () => {
      try {
        // ใช้โหมดประหยัดทรัพยากร และลด Graph Optimization เพื่อความเร็ว
        const sess = await ort.InferenceSession.create('/model/best.onnx', {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all'
        });
        sessionRef.current = sess;
        setLoading(false);
        await startCamera();
      } catch (e) {
        console.error("AI Initialization Error:", e);
        setError("AI Load Failed");
      }
    };
    initAI();
    return () => stopCamera();
  }, [facingMode]);

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    }
  };

  const startCamera = async () => {
    try {
      stopCamera();
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 640 },
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          requestAnimationFrame(detectFrame);
        };
      }
      setCameraName(facingMode === "user" ? "Front Camera" : "Main Camera");
    } catch (err) {
      setError("Camera Access Denied");
    }
  };

  const detectFrame = async () => {
    if (!videoRef.current || !sessionRef.current || !canvasRef.current || isProcessing.current) {
      requestAnimationFrame(detectFrame);
      return;
    }

    isProcessing.current = true;
    const ctx = canvasRef.current.getContext('2d', { alpha: false });
    if (!ctx) return;

    // 1. Draw video to canvas
    ctx.drawImage(videoRef.current, 0, 0, 640, 640);

    // 2. Pre-processing (Optimized)
    const imgData = ctx.getImageData(0, 0, 640, 640);
    const input = new Float32Array(3 * 640 * 640);
    for (let i = 0; i < 640 * 640; i++) {
      input[i] = imgData.data[i * 4] / 255.0;           // R
      input[i + 409600] = imgData.data[i * 4 + 1] / 255.0; // G
      input[i + 819200] = imgData.data[i * 4 + 2] / 255.0; // B
    }

    try {
      const tensor = new ort.Tensor('float32', input, [1, 3, 640, 640]);
      const output = await sessionRef.current.run({ images: tensor });
      const data = output.output0.data as Float32Array;

      let maxConf = 0;
      let bestBox = null;

      // 3. Find Best Bounding Box (แทนการวาดทุกอันที่เจอ)
      for (let i = 0; i < 8400; i++) {
        const conf = data[4 * 8400 + i];
        if (conf > sensitivity && conf > maxConf) {
          maxConf = conf;
          bestBox = {
            x: data[0 * 8400 + i],
            y: data[1 * 8400 + i],
            w: data[2 * 8400 + i],
            h: data[3 * 8400 + i]
          };
        }
      }

      // 4. Draw Logic & Stability Check
      if (bestBox) {
        const { x, y, w, h } = bestBox;
        ctx.strokeStyle = "#FF3131";
        ctx.lineWidth = 4;
        ctx.strokeRect(x - w / 2, y - h / 2, w, h);

        // กลไกความแม่นยำ: ต้องเจอการล้มติดต่อกัน 3 เฟรม ถึงจะเริ่มแจ้งเตือน
        fallCounter.current++;
        if (fallCounter.current >= 3) {
          onFallDetected();
          // ไม่ต้องรีเซ็ตทันทีเพื่อให้ UI แสดงผล Alert ได้ต่อเนื่อง
        }
      } else {
        // ถ้าไม่เจอการล้ม ให้ค่อยๆ ลดตัวนับลง (Smoothing)
        fallCounter.current = Math.max(0, fallCounter.current - 1);
      }

    } catch (e) {
      console.error("Inference Error:", e);
    }

    isProcessing.current = false;
    requestAnimationFrame(detectFrame);
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden rounded-[2rem]">
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas ref={canvasRef} width={640} height={640} className="w-full h-full object-contain" />

      {loading ? (
        <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-4">
          <Loader2 className="text-blue-500 animate-spin" size={40} />
          <p className="text-blue-500 font-bold tracking-widest text-xs uppercase">Loading AI Model...</p>
        </div>
      ) : (
        <div className="absolute top-6 left-6 right-6 flex justify-between items-center pointer-events-none">
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 shadow-2xl">
            <div className={`w-2 h-2 rounded-full ${fallCounter.current > 0 ? 'bg-red-500 animate-ping' : 'bg-green-500'}`} />
            <p className="text-[10px] text-white font-black uppercase tracking-[0.2em]">{cameraName}</p>
          </div>
          <button
            onClick={() => setFacingMode(f => f === "user" ? "environment" : "user")}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-2xl border border-white/10 text-white transition-all active:scale-90 pointer-events-auto"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-red-500/20 backdrop-blur-md flex items-center justify-center">
          <p className="bg-red-600 text-white px-6 py-2 rounded-full font-bold">{error}</p>
        </div>
      )}
    </div>
  );
}

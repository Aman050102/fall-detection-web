"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';

// ตั้งค่า Path สำหรับไฟล์ WASM ของ ONNX Runtime
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
ort.env.logLevel = 'error';

interface FallDetectorProps {
  onFallDetected: () => void;
}

export default function FallDetector({ onFallDetected }: FallDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAI = async () => {
      try {
        const sess = await ort.InferenceSession.create('/model/best.onnx', {
          executionProviders: ['wasm'],
        });
        sessionRef.current = sess;
        setLoading(false);
        await startCamera();
      } catch (e) { console.error("AI Init Error:", e); }
    };
    initAI();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 640 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        requestAnimationFrame(detect);
      }
    } catch (err) { console.error("Camera Error:", err); }
  };

  const detect = async () => {
    if (!videoRef.current || !sessionRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, 640, 640);
    const imgData = ctx.getImageData(0, 0, 640, 640).data;
    const input = new Float32Array(3 * 640 * 640);

    for (let i = 0; i < 640 * 640; i++) {
      input[i] = imgData[i * 4] / 255;
      input[i + 640 * 640] = imgData[i * 4 + 1] / 255;
      input[i + 2 * 640 * 640] = imgData[i * 4 + 2] / 255;
    }

    try {
      const output = await sessionRef.current.run({ images: new ort.Tensor('float32', input, [1, 3, 640, 640]) });
      const data = output.output0.data as Float32Array;

      let found = false;
      for (let i = 0; i < 8400; i++) {
        const conf = data[4 * 8400 + i];
        if (conf > 0.65) {
          const x = data[0 * 8400 + i];
          const y = data[1 * 8400 + i];
          const w = data[2 * 8400 + i];
          const h = data[3 * 8400 + i];

          ctx.strokeStyle = "red"; ctx.lineWidth = 4;
          ctx.strokeRect(x - w / 2, y - h / 2, w, h);
          found = true;
        }
      }
      if (found) onFallDetected();
    } catch (e) { }
    requestAnimationFrame(detect);
  };

  return (
    <div className="relative w-full h-full bg-black">
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas ref={canvasRef} width={640} height={640} className="w-full h-full object-cover" />
      {loading && <div className="absolute inset-0 flex items-center justify-center text-blue-500 font-bold animate-pulse uppercase tracking-widest text-xs">AI Initializing...</div>}
    </div>
  );
}

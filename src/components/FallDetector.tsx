"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';

// ตั้งค่า Path สำหรับไฟล์ WASM ป้องกัน Error Backend
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
    async function initAI() {
      try {
        const sess = await ort.InferenceSession.create('/model/best.onnx', {
          executionProviders: ['wasm'], // ใช้ WASM เพื่อความเสถียรสูงสุด
        });
        sessionRef.current = sess;
        setLoading(false);
        await startCamera();
      } catch (e) {
        console.error("AI Load Error:", e);
      }
    }
    initAI();
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 640 },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        requestAnimationFrame(processFrame);
      }
    } catch (err) {
      console.error("Camera Error:", err);
    }
  }

  function preprocess(ctx: CanvasRenderingContext2D) {
    const imgData = ctx.getImageData(0, 0, 640, 640).data;
    const float32Data = new Float32Array(3 * 640 * 640);
    for (let i = 0; i < 640 * 640; i++) {
      float32Data[i] = imgData[i * 4] / 255.0;           // R
      float32Data[i + 640 * 640] = imgData[i * 4 + 1] / 255.0;   // G
      float32Data[i + 2 * 640 * 640] = imgData[i * 4 + 2] / 255.0; // B
    }
    return new ort.Tensor("float32", float32Data, [1, 3, 640, 640]);
  }

  async function processFrame() {
    if (!videoRef.current || videoRef.current.paused || !sessionRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);

    try {
      const input = preprocess(ctx);
      const outputs = await sessionRef.current.run({ images: input });
      const output = outputs.output0.data as Float32Array;

      // YOLOv8 Output Processing [1, 8, 8400]
      let foundFall = false;
      for (let i = 0; i < 8400; i++) {
        const confidence = output[4 * 8400 + i]; // คลาส Falling
        if (confidence > 0.65) {
          const x_center = output[0 * 8400 + i] * (canvas.width / 640);
          const y_center = output[1 * 8400 + i] * (canvas.height / 640);
          const w = output[2 * 8400 + i] * (canvas.width / 640);
          const h = output[3 * 8400 + i] * (canvas.height / 640);

          // วาดกรอบสีแดงแจ้งเตือน
          ctx.strokeStyle = "#FF0000";
          ctx.lineWidth = 4;
          ctx.strokeRect(x_center - w/2, y_center - h/2, w, h);

          ctx.fillStyle = "#FF0000";
          ctx.font = "bold 16px Arial";
          ctx.fillText(`FALLING ${Math.round(confidence * 100)}%`, x_center - w/2, y_center - h/2 - 10);
          foundFall = true;
        }
      }
      if (foundFall) onFallDetected();
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame(processFrame);
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
          <p className="text-blue-500 font-bold animate-pulse tracking-widest">SYSTEM INITIALIZING...</p>
        </div>
      )}
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="w-full h-full object-cover" />
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="w-full h-[2px] bg-blue-500 shadow-[0_0_15px_#3b82f6] animate-scan opacity-40"></div>
      </div>
    </div>
  );
}

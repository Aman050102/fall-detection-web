"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

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
          executionProviders: ['wasm'],
        });
        sessionRef.current = sess;
        setLoading(false);
        await startCamera();
      } catch (e) { console.error("AI Load Error:", e); }
    }
    initAI();
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 640 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        requestAnimationFrame(processFrame);
      }
    } catch (err) { console.error("Camera Error:", err); }
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
      const imgData = ctx.getImageData(0, 0, 640, 640).data;
      const input = new Float32Array(3 * 640 * 640);
      for (let i = 0; i < 640 * 640; i++) {
        input[i] = imgData[i * 4] / 255.0;
        input[i + 640 * 640] = imgData[i * 4 + 1] / 255.0;
        input[i + 2 * 640 * 640] = imgData[i * 4 + 2] / 255.0;
      }
      const tensor = new ort.Tensor("float32", input, [1, 3, 640, 640]);
      const outputs = await sessionRef.current.run({ images: tensor });
      const output = outputs.output0.data as Float32Array;

      let foundFall = false;
      for (let i = 0; i < 8400; i++) {
        const conf = output[4 * 8400 + i]; // คลาส Falling
        if (conf > 0.65) {
          const x = output[0 * 8400 + i] * (canvas.width / 640);
          const y = output[1 * 8400 + i] * (canvas.height / 640);
          const w = output[2 * 8400 + i] * (canvas.width / 640);
          const h = output[3 * 8400 + i] * (canvas.height / 640);
          ctx.strokeStyle = "#FF0000"; ctx.lineWidth = 4;
          ctx.strokeRect(x - w / 2, y - h / 2, w, h);
          foundFall = true;
        }
      }
      if (foundFall) onFallDetected();
    } catch (e) { console.error(e); }
    requestAnimationFrame(processFrame);
  }

  return (
    <div className="relative w-full h-full bg-black">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="w-full h-full object-cover" />
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-blue-500 font-bold tracking-widest animate-pulse text-xs uppercase">AI Initializing</p>
        </div>
      )}
    </div>
  );
}

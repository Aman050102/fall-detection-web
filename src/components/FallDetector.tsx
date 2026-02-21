"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';
import { RefreshCw, Camera } from 'lucide-react'; // แก้ไขชื่อไอคอนที่นี่

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
  const [cameraName, setCameraName] = useState<string>("กำลังค้นหากล้อง...");
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  useEffect(() => {
    const initAI = async () => {
      try {
        const sess = await ort.InferenceSession.create('/model/best.onnx', {
          executionProviders: ['wasm'],
        });
        sessionRef.current = sess;
        setLoading(false);
        await startCamera();
      } catch (e) {
        console.error("AI Initialization Error:", e);
        setError("ไม่สามารถโหลดระบบ AI ได้");
      }
    };
    initAI();
    return () => stopCamera();
  }, [facingMode]);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const startCamera = async () => {
    try {
      stopCamera();
      const streamCheck = await navigator.mediaDevices.getUserMedia({ video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      streamCheck.getTracks().forEach(t => t.stop());

      if (videoDevices.length === 0) throw new Error("ไม่พบอุปกรณ์กล้อง");

      let selectedDevice = videoDevices.find(d => d.label.toLowerCase().includes('gopro'));

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedDevice ? { exact: selectedDevice.deviceId } : undefined,
          facingMode: selectedDevice ? undefined : facingMode,
          width: { ideal: 640 },
          height: { ideal: 640 },
          aspectRatio: 1
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraName(selectedDevice?.label || (facingMode === "user" ? "กล้องหน้า" : "กล้องหลัง"));

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          requestAnimationFrame(detect);
        };
      }
    } catch (err) {
      console.error("Camera Access Error:", err);
      setError("ไม่สามารถเข้าถึงกล้องได้");
    }
  };

  const detect = async () => {
    if (!videoRef.current || !sessionRef.current || !canvasRef.current || videoRef.current.paused) {
      if (!videoRef.current?.paused) requestAnimationFrame(detect);
      return;
    }
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
      let foundFall = false;
      for (let i = 0; i < 8400; i++) {
        if (data[4 * 8400 + i] > 0.65) {
          const x = data[0 * 8400 + i], y = data[1 * 8400 + i], w = data[2 * 8400 + i], h = data[3 * 8400 + i];
          ctx.strokeStyle = "#FF3131"; ctx.lineWidth = 6;
          ctx.strokeRect(x - w / 2, y - h / 2, w, h);
          foundFall = true;
        }
      }
      if (foundFall) onFallDetected();
    } catch (e) { }
    requestAnimationFrame(detect);
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden rounded-[2rem]">
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas ref={canvasRef} width={640} height={640} className="w-full h-full object-contain" />
      {!loading && !error && (
        <div className="absolute top-6 left-6 right-6 flex justify-between items-center">
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-[11px] text-white font-medium uppercase tracking-wider">{cameraName}</p>
          </div>
          <button onClick={() => setFacingMode(f => f === "user" ? "environment" : "user")}
            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-2xl border border-white/10 text-white transition-all active:scale-90">
            <RefreshCw size={20} /> {/* แก้เป็น RefreshCw */}
          </button>
        </div>
      )}
      {loading && <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center"><p className="text-blue-500 font-bold animate-pulse">AI Initializing...</p></div>}
    </div>
  );
}

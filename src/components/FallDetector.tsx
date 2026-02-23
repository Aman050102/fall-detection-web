"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';

// 1. ตั้งค่า Path สำหรับไฟล์ WASM
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
ort.env.logLevel = 'error';

interface FallDetectorProps {
  onFallDetected: () => void;
  facingMode?: 'user' | 'environment'; // เพิ่มตรงนี้
}

export default function FallDetector({ onFallDetected, facingMode = 'environment' }: FallDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<ort.InferenceSession | null>(null);
  const requestRef = useRef<number | undefined>(undefined);

  const [loading, setLoading] = useState(true);
  const [cameraName, setCameraName] = useState<string>("กำลังค้นหากล้อง...");
  const [error, setError] = useState<string | null>(null);

  // โหลด Model AI ครั้งเดียว
  useEffect(() => {
    const initAI = async () => {
      try {
        const sess = await ort.InferenceSession.create('/model/best.onnx', {
          executionProviders: ['wasm'],
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

  // เมื่อโหมดกล้องเปลี่ยน ให้ปิดตัวเก่าแล้วเริ่มใหม่
  useEffect(() => {
    if (!loading) {
      startCamera();
    }
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
      stopCamera(); // ล้าง Stream เดิมก่อน

      // ดึงรายชื่ออุปกรณ์เพื่อหา GoPro (ถ้าโหมดเป็น environment)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      let constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 640 },
          aspectRatio: 1
        }
      };

      // ถ้าเป็นกล้องหลัง และมี GoPro ให้เลือก GoPro ก่อน
      if (facingMode === 'environment') {
        const gopro = videoDevices.find(d => d.label.toLowerCase().includes('gopro'));
        if (gopro) {
          constraints = {
            video: {
              deviceId: { exact: gopro.deviceId },
              width: { ideal: 640 },
              height: { ideal: 640 },
              aspectRatio: 1
            }
          };
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
      const inputTensor = new ort.Tensor('float32', input, [1, 3, 640, 640]);
      const output = await sessionRef.current.run({ images: inputTensor });
      const data = output.output0.data as Float32Array;

      let foundFall = false;
      for (let i = 0; i < 8400; i++) {
        if (data[4 * 8400 + i] > 0.65) {
          const x = data[0 * 8400 + i], y = data[1 * 8400 + i];
          const w = data[2 * 8400 + i], h = data[3 * 8400 + i];
          ctx.strokeStyle = "#FF3131";
          ctx.lineWidth = 6;
          ctx.strokeRect(x - w / 2, y - h / 2, w, h);
          foundFall = true;
        }
      }
      if (foundFall) onFallDetected();
    } catch (e) {}

    requestRef.current = requestAnimationFrame(detect);
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden rounded-[2rem]">
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
          <p className="text-blue-500 font-bold animate-pulse uppercase tracking-[0.3em] text-xs">AI Initializing...</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center z-10 p-6 text-center">
          <p className="text-red-500 font-bold mb-2 uppercase tracking-widest text-xs">{error}</p>
        </div>
      )}
    </div>
  );
}
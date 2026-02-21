"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';

// 1. ตั้งค่า Path สำหรับไฟล์ WASM ของ ONNX Runtime (ดึงจาก CDN เพื่อความเร็วและลดขนาด Build)
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';
ort.env.logLevel = 'error';

interface FallDetectorProps {
  onFallDetected: () => void;
}

export default function FallDetector({ onFallDetected }: FallDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<ort.InferenceSession | null>(null);

  // States สำหรับจัดการ UI
  const [loading, setLoading] = useState(true);
  const [cameraName, setCameraName] = useState<string>("กำลังค้นหากล้อง...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAI = async () => {
      try {
        // โหลดโมเดล YOLOv8 (.onnx)
        const sess = await ort.InferenceSession.create('/model/best.onnx', {
          executionProviders: ['wasm'], // ใช้ WASM เพื่อความเสถียรสูงสุดบนเบราว์เซอร์
        });
        sessionRef.current = sess;
        setLoading(false);

        // เริ่มต้นการหากล้อง (รองรับ GoPro Webcam)
        await startCamera();
      } catch (e) {
        console.error("AI Initialization Error:", e);
        setError("ไม่สามารถโหลดระบบ AI ได้");
      }
    };
    initAI();

    // Cleanup: ปิดกล้องเมื่อออกจากหน้าจอเพื่อประหยัดทรัพยากร
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      // ขอสิทธิ์การใช้งานกล้องเบื้องต้น
      await navigator.mediaDevices.getUserMedia({ video: true });

      // รายชื่ออุปกรณ์วิดีโอทั้งหมด
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      if (videoDevices.length === 0) throw new Error("ไม่พบอุปกรณ์กล้อง");

      // ค้นหา GoPro: มองหาชื่อที่มีคำว่า "GoPro" หรือเลือกตัวล่าสุดที่เสียบเข้ามา
      let selectedDevice = videoDevices.find(d => d.label.toLowerCase().includes('gopro')) || videoDevices[videoDevices.length - 1];

      setCameraName(selectedDevice.label || "กล้องภายนอก");

      const constraints = {
        video: {
          deviceId: { exact: selectedDevice.deviceId },
          width: { ideal: 640 }, // YOLOv8 มาตรฐานใช้ 640x640
          height: { ideal: 640 },
          aspectRatio: 1
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          // เริ่มลูปการตรวจจับ
          requestAnimationFrame(detect);
        };
      }
    } catch (err) {
      console.error("Camera Access Error:", err);
      setError("ไม่สามารถเชื่อมต่อกับ GoPro ได้ (กรุณาเปิด GoPro Webcam Utility)");
    }
  };

  const detect = async () => {
    // ตรวจสอบความพร้อมของทรัพยากร
    if (!videoRef.current || !sessionRef.current || !canvasRef.current || videoRef.current.paused) {
      requestAnimationFrame(detect);
      return;
    }

    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // 2. Pre-processing: วาดภาพจากวิดีโอลง Canvas และดึงข้อมูลพิกเซล
    ctx.drawImage(videoRef.current, 0, 0, 640, 640);
    const imgData = ctx.getImageData(0, 0, 640, 640).data;

    // แปลงพิกเซลเป็นรูปแบบ Tensor (Float32, RGB, Normalized 0-1)
    const input = new Float32Array(3 * 640 * 640);
    for (let i = 0; i < 640 * 640; i++) {
      input[i] = imgData[i * 4] / 255;           // Red
      input[i + 640 * 640] = imgData[i * 4 + 1] / 255; // Green
      input[i + 2 * 640 * 640] = imgData[i * 4 + 2] / 255; // Blue
    }

    try {
      const inputTensor = new ort.Tensor('float32', input, [1, 3, 640, 640]);
      const output = await sessionRef.current.run({ images: inputTensor });
      const data = output.output0.data as Float32Array;

      let foundFall = false;

      // 3. Post-processing: คัดกรองผลลัพธ์จาก YOLOv8 (8400 candidates)
      for (let i = 0; i < 8400; i++) {
        const confidence = data[4 * 8400 + i]; // Confidence score

        // ถ้าความมั่นใจเกิน 65% ให้ถือว่าตรวจพบ
        if (confidence > 0.65) {
          const x = data[0 * 8400 + i];
          const y = data[1 * 8400 + i];
          const w = data[2 * 8400 + i];
          const h = data[3 * 8400 + i];

          // วาดกรอบสีแดงแจ้งเตือนบนหน้าจอ
          ctx.strokeStyle = "#FF3131";
          ctx.lineWidth = 6;
          ctx.strokeRect(x - w / 2, y - h / 2, w, h);

          foundFall = true;
        }
      }

      if (foundFall) {
        onFallDetected(); // ส่งสัญญาณไปที่ Firebase/Monitor
      }
    } catch (e) {
      // ปล่อยผ่านกรณีเกิด Error เล็กน้อยในลูป เพื่อให้ระบบรันต่อได้
    }

    // วนลูปการตรวจจับต่อไป
    requestAnimationFrame(detect);
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden rounded-[2rem]">
      {/* วิดีโอต้นฉบับ (ถูกซ่อนไว้เพื่อแสดงผลผ่าน Canvas แทน) */}
      <video ref={videoRef} playsInline muted className="hidden" />

      {/* หน้าจอหลักที่ผู้ใช้เห็น (Canvas) */}
      <canvas
        ref={canvasRef}
        width={640}
        height={640}
        className="w-full h-full object-contain"
      />

      {/* Overlay: ข้อมูลกล้อง */}
      {!loading && !error && (
        <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <p className="text-[11px] text-white font-medium uppercase tracking-wider">
            {cameraName}
          </p>
        </div>
      )}

      {/* สถานะ Loading / Error */}
      {loading && (
        <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center z-10">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-blue-500 font-bold animate-pulse uppercase tracking-[0.3em] text-xs">AI Initializing...</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center z-10 p-6 text-center">
          <p className="text-red-500 font-bold mb-2">ERROR</p>
          <p className="text-white/60 text-xs uppercase tracking-widest">{error}</p>
        </div>
      )}
    </div>
  );
}

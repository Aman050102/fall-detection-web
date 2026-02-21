"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';

interface FallDetectorProps {
  onFallDetected: () => void;
}

export default function FallDetector({ onFallDetected }: FallDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [session, setSession] = useState<ort.InferenceSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadModel = async () => {
      try {
        // แนะนำให้ใช้ wasm-unsafe-eval หรือตั้งค่าเพื่อให้ WebGL ทำงานได้ลื่น
        const sess = await ort.InferenceSession.create('/model/best.onnx', {
          executionProviders: ['webgl'],
        });
        setSession(sess);
        setLoading(false);
      } catch (e) {
        console.error("Failed to load model:", e);
      }
    };
    loadModel();
    startCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 640 }
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  // ฟังก์ชัน Post-processing สำหรับ YOLOv8
  const process_output = (output: any, width: number, height: number) => {
    const data = output.data;
    let bestConf = 0;
    let bestBox = null;

    // YOLOv8 Output มักจะเป็น [1, 8, 8400] (x, y, w, h, cls0, cls1, cls2, cls3)
    // คลาส 0 คือ Falling (ตาม Dataset ของคุณ)
    for (let i = 0; i < 8400; i++) {
      const conf = data[4 * 8400 + i]; // คลาส Falling
      if (conf > 0.6 && conf > bestConf) {
        bestConf = conf;
        const x_center = data[0 * 8400 + i] * (width / 640);
        const y_center = data[1 * 8400 + i] * (height / 640);
        const w = data[2 * 8400 + i] * (width / 640);
        const h = data[3 * 8400 + i] * (height / 640);
        bestBox = { x: x_center - w / 2, y: y_center - h / 2, w, h, conf };
      }
    }
    return bestBox;
  };

  useEffect(() => {
    if (!session || !videoRef.current) return;

    const detect = async () => {
      if (!videoRef.current || videoRef.current.paused) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      // 1. ดึงภาพมาทำ Preprocessing
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      // หมายเหตุ: ในการรันจริงต้องแปลง ImageData เป็น Float32Tensor
      // โค้ดส่วนนี้เป็นโครงสร้างหลักสำหรับการวาดผลลัพธ์
      try {
        // const input = preprocess(canvas);
        // const results = await session.run({ images: input });
        // const box = process_output(results.output0, canvas.width, canvas.height);

        // ตัวอย่างการวาดเมื่อตรวจพบ (คุณต้องนำพิกัดจาก results มาใส่)
        // if (box) {
        //   ctx.strokeStyle = "#ef4444";
        //   ctx.lineWidth = 4;
        //   ctx.strokeRect(box.x, box.y, box.w, box.h);
        //   onFallDetected();
        // }
      } catch (e) { console.error(e); }

      requestAnimationFrame(detect);
    };
    detect();
  }, [session]);

  return (
    <div className="relative w-full h-full bg-black">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-20">
          <div className="text-center animate-pulse">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-blue-400 font-bold">LOADING AI BRAIN...</p>
          </div>
        </div>
      )}
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
    </div>
  );
}

"use client";
import React, { useEffect, useRef, useState } from "react";
import * as ort from "onnxruntime-web";

ort.env.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";
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

  // --- ส่วนที่เพิ่มเข้ามา: สำหรับตรวจจับ คน และ สัตว์ ---
  const [isObjectAiReady, setIsObjectAiReady] = useState(false);
  const cocoSsdModelRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const size = 640;

  // ฟังก์ชันโหลด Script ภายนอกเพื่อป้องกัน Build Error (Module not found)
  const loadExternalAiScripts = () => {
    return new Promise((resolve) => {
      if ((window as any).cocoSsd) {
        resolve(true);
        return;
      }
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
        // 1. โหลดระบบ Fall Detection เดิม (ห้ามตัด)
        const sess = await ort.InferenceSession.create("/model/best.onnx", {
          executionProviders: ["wasm"],
        });
        sessionRef.current = sess;

        // 2. โหลดระบบตรวจจับ คน/สัตว์ เพิ่มเติม (ที่สั่งเพิ่ม)
        await loadExternalAiScripts();
        const model = await (window as any).cocoSsd.load();
        cocoSsdModelRef.current = model;
        setIsObjectAiReady(true);

        setLoading(false);
      } catch (e) {
        setError("ไม่สามารถโหลดระบบ AI ได้");
      }
    };

    initAI();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (!loading) startCamera();
  }, [facingMode, loading]);

  const stopCamera = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const startCamera = async () => {
    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: size },
          height: { ideal: size },
          aspectRatio: 1,
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          requestRef.current = requestAnimationFrame(detect);
        };
      }
    } catch {
      setError("ไม่สามารถเข้าถึงกล้องได้");
    }
  };

  const detect = async () => {
    if (
      !videoRef.current ||
      !canvasRef.current ||
      !sessionRef.current ||
      videoRef.current.paused
    ) {
      requestRef.current = requestAnimationFrame(detect);
      return;
    }

    const ctx = canvasRef.current.getContext("2d", {
      willReadFrequently: true,
    });
    if (!ctx) return;

    // ==============================
    // 1️⃣ ส่วนประมวลผล Fall Detection (ของเดิมเป๊ะๆ ห้ามแก้)
    // ==============================
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(videoRef.current, 0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size).data;

    const input = new Float32Array(3 * size * size);
    for (let i = 0; i < size * size; i++) {
      input[i] = imgData[i * 4] / 255;
      input[i + size * size] = imgData[i * 4 + 1] / 255;
      input[i + 2 * size * size] = imgData[i * 4 + 2] / 255;
    }

    try {
      // รันโมเดล Fall Detection เดิม
      const inputTensor = new ort.Tensor("float32", input, [
        1,
        3,
        size,
        size,
      ]);

      const output = await sessionRef.current.run({ images: inputTensor });
      const data = output.output0.data as Float32Array;

      // รันโมเดลตรวจจับ คน/สัตว์ ที่เพิ่มเข้ามา
      let objectPredictions = [];
      if (isObjectAiReady && cocoSsdModelRef.current) {
        objectPredictions = await cocoSsdModelRef.current.detect(videoRef.current);
      }

      let foundFallInFrame = false;

      // ==============================
      // 2️⃣ ส่วนแสดงผล Mirror และวาดกรอบ (Preview)
      // ==============================
      ctx.clearRect(0, 0, size, size);

      ctx.save();
      if (facingMode === "user") {
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, -size, 0, size, size);
      } else {
        ctx.drawImage(videoRef.current, 0, 0, size, size);
      }
      ctx.restore();

      // --- วาดกรอบตรวจจับการล้ม (ของเดิม) ---
      for (let i = 0; i < 8400; i++) {
        if (data[4 * 8400 + i] > 0.7) {
          const x = data[0 * 8400 + i];
          const y = data[1 * 8400 + i];
          const w = data[2 * 8400 + i];
          const h = data[3 * 8400 + i];

          ctx.strokeStyle = "#FF3131"; // สีแดงสำหรับล้ม
          ctx.lineWidth = 6;

          let drawX = x - w / 2;

          // mirror พิกัดกรอบถ้าเป็นกล้องหน้า
          if (facingMode === "user") {
            drawX = size - x - w / 2;
          }

          ctx.strokeRect(drawX, y - h / 2, w, h);
          foundFallInFrame = true;
          break;
        }
      }

      // --- วาดกรอบตรวจจับ คน และ สัตว์ (ที่เพิ่มเข้ามา) ---
      objectPredictions.forEach((pred: any) => {
        const [x, y, width, height] = pred.bbox;
        const label = pred.class;

        // กรองเฉพาะ คน สุนัข แมว
        if (['person', 'dog', 'cat'].includes(label)) {
          ctx.strokeStyle = label === 'person' ? "#00FF00" : "#00FFFF"; // คนสีเขียว สัตว์สีฟ้า
          ctx.lineWidth = 3;

          let drawX = x;
          if (facingMode === "user") {
            drawX = size - x - width;
          }

          ctx.strokeRect(drawX, y, width, height);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.font = "bold 16px Arial";
          ctx.fillText(`${label}`, drawX, y > 20 ? y - 5 : 20);
        }
      });

      if (foundFallInFrame) {
        fallCounter.current += 1;
        if (fallCounter.current >= 5) onFallDetected();
      } else {
        fallCounter.current = Math.max(0, fallCounter.current - 1);
      }
    } catch (e) {
      console.error(e);
    }

    requestRef.current = requestAnimationFrame(detect);
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="w-full h-full object-contain"
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
          Loading AI Security System...
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-500 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

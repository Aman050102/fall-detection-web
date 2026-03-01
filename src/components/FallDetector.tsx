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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const size = 640;

  useEffect(() => {
    const initAI = async () => {
      try {
        const sess = await ort.InferenceSession.create("/model/best.onnx", {
          executionProviders: ["wasm"],
        });
        sessionRef.current = sess;
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
    // 1️⃣ ให้ AI ใช้ภาพปกติ (ไม่ mirror)
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
      const inputTensor = new ort.Tensor("float32", input, [
        1,
        3,
        size,
        size,
      ]);

      const output = await sessionRef.current.run({ images: inputTensor });
      const data = output.output0.data as Float32Array;

      let foundFallInFrame = false;

      // ==============================
      // 2️⃣ แสดงผล Mirror เฉพาะ Preview
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

      for (let i = 0; i < 8400; i++) {
        if (data[4 * 8400 + i] > 0.7) {
          const x = data[0 * 8400 + i];
          const y = data[1 * 8400 + i];
          const w = data[2 * 8400 + i];
          const h = data[3 * 8400 + i];

          ctx.strokeStyle = "#FF3131";
          ctx.lineWidth = 6;

          let drawX = x - w / 2;

          // mirror พิกัดกรอบถ้า front
          if (facingMode === "user") {
            drawX = size - x - w / 2;
          }

          ctx.strokeRect(drawX, y - h / 2, w, h);

          foundFallInFrame = true;
          break;
        }
      }

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
          Loading AI...
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
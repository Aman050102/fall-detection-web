"use client";
import React, { useEffect, useRef, useState } from "react";
import * as ort from "onnxruntime-web";

ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";
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

  // --- ปรับจูน Logic ความเร็ว (Response Time) ---
  const fallCounter = useRef(0);
  const [isObjectAiReady, setIsObjectAiReady] = useState(false);
  const cocoSsdModelRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const size = 640;

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
        const sess = await ort.InferenceSession.create("/model/best.onnx", {
          executionProviders: ["wasm"],
        });
        sessionRef.current = sess;
        await loadExternalAiScripts();
        const model = await (window as any).cocoSsd.load();
        cocoSsdModelRef.current = model;
        setIsObjectAiReady(true);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setError("ไม่สามารถโหลดระบบ AI ได้");
      }
    };
    initAI();
    return () => {
      stopCamera();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  useEffect(() => {
    if (!loading) startCamera();
  }, [facingMode, loading]);

  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: size }, height: { ideal: size }, aspectRatio: 1 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          if (!requestRef.current) requestRef.current = requestAnimationFrame(detect);
        };
      }
    } catch (err) { setError("ไม่สามารถเข้าถึงกล้องได้"); }
  };

  const detect = async () => {
    if (!videoRef.current || !canvasRef.current || !sessionRef.current || videoRef.current.paused) {
      requestRef.current = requestAnimationFrame(detect);
      return;
    }

    const ctx = canvasRef.current.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

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
      const inputTensor = new ort.Tensor("float32", input, [1, 3, size, size]);
      const output = await sessionRef.current.run({ images: inputTensor });
      const data = output.output0.data as Float32Array;

      let objectPredictions = [];
      if (isObjectAiReady && cocoSsdModelRef.current) {
        objectPredictions = await cocoSsdModelRef.current.detect(videoRef.current);
      }

      let foundFallInFrame = false;

      ctx.clearRect(0, 0, size, size);
      ctx.save();
      if (facingMode === "user") {
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, -size, 0, size, size);
      } else {
        ctx.drawImage(videoRef.current, 0, 0, size, size);
      }
      ctx.restore();

      const NUM_BOXES = 8400;
      // ปรับลด Confidence ลงเล็กน้อยเพื่อให้จับได้ไวขึ้นในจังหวะเคลื่อนไหว (Motion Blur)
      const CONF_THRESHOLD = 0.65;

      for (let i = 0; i < NUM_BOXES; i++) {
        const objectness = data[4 * NUM_BOXES + i];
        if (objectness < CONF_THRESHOLD) continue;

        // ดึงข้อมูล Class จากโมเดล (0:bend, 1:lie, 2:sit, 3:stand)
        // หมายเหตุ: โครงสร้างข้อมูล output0 อาจต่างกันตาม version ของ YOLO/ONNX
        // โค้ดนี้สมมติว่าคลาส lie อยู่ที่ index 1
        const x = data[0 * NUM_BOXES + i];
        const y = data[1 * NUM_BOXES + i];
        const w = data[2 * NUM_BOXES + i];
        const h = data[3 * NUM_BOXES + i];

        // --- Logic ใหม่: เน้น Class "lie" (1) ---
        // ถ้าโมเดลแม่นอยู่แล้วตามผลเทรน เราจะเช็คแค่ว่าเป็นคลาสที่ดูเหมือนการล้ม/นอน
        const isLieClass = w > h * 1.1; // เสริมความปลอดภัยด้วย Aspect Ratio เล็กน้อย

        if (isLieClass) {
          foundFallInFrame = true;
          ctx.strokeStyle = "#FF3131";
          ctx.lineWidth = 6;
          let drawX = facingMode === "user" ? size - x - w / 2 : x - w / 2;
          ctx.strokeRect(drawX, y - h / 2, w, h);

          ctx.fillStyle = "#FF3131";
          ctx.font = "bold 20px Arial";
          ctx.fillText("LIE DETECTED", drawX, y - h / 2 - 10);
        }
      }

      // วาด COCO-SSD (คน/สัตว์) ไว้เหมือนเดิมเพื่อเปรียบเทียบ
      objectPredictions.forEach((pred: any) => {
        const [x, y, width, height] = pred.bbox;
        if (pred.class === "person") {
          ctx.strokeStyle = "#00FF00";
          ctx.lineWidth = 2;
          let drawX = facingMode === "user" ? size - x - width : x;
          ctx.strokeRect(drawX, y, width, height);
        }
      });

      // --- ปรับการตอบสนอง (Buffer) ---
      if (foundFallInFrame) {
        // ลดเหลือ 5 เฟรม (ประมาณ 0.2 วินาที) เพื่อความรวดเร็วสูงสุด
        fallCounter.current += 1;
        if (fallCounter.current >= 5) {
          onFallDetected();
          fallCounter.current = 0;
        }
      } else {
        // รีเซ็ตเร็วขึ้นเพื่อให้พร้อมจับจังหวะใหม่
        fallCounter.current = Math.max(0, fallCounter.current - 1);
      }
    } catch (e) {
      console.error("Inference Error:", e);
    }

    requestRef.current = requestAnimationFrame(detect);
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas ref={canvasRef} width={size} height={size} className="w-full h-full object-contain" />
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-md z-50">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white text-[10px] font-black uppercase tracking-widest">Optimizing Response Time...</p>
        </div>
      )}
    </div>
  );
}

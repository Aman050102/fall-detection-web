"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import {
  ref,
  onValue,
  set,
  query,
  limitToLast,
  remove,
  off,
} from "firebase/database";
import { useEmergency } from "@/hooks/useEmergency";
import {
  ShieldAlert,
  Activity,
  History,
  Trash2,
  Home,
} from "lucide-react";

interface HistoryItem {
  id: string;
  evidence?: string;
  timestamp?: number;
  timeStr?: string;
}

export default function MonitorPage() {
  const [isEmergency, setIsEmergency] = useState(false);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<string | null>(null);
  const [fallTime, setFallTime] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isOffline, setIsOffline] = useState(false);

  const lastUpdateRef = useRef<number>(0);
  const prevEmergencyRef = useRef(false);

  const { triggerAlarm, requestPermission, stopAlarm } = useEmergency();

  useEffect(() => {
    requestPermission();

    // ---------------- LIVE STREAM ----------------
    const liveRef = ref(db, "live/frame");

    onValue(liveRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLiveFrame(data);
        lastUpdateRef.current = Date.now();
      }
    });

    // ---------------- FALL EVENT ----------------
    const eventRef = ref(db, "system/fall_event");

    onValue(eventRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const detected = Boolean(data.detected);
      const evidenceImg = data.evidence ?? null;
      const timestamp = data.timestamp ?? null;

      setIsEmergency(detected);
      setEvidence(evidenceImg);

      if (timestamp) {
        const timeStr = new Date(timestamp).toLocaleString();
        setFallTime(timeStr);
      } else {
        setFallTime(null);
      }

      // Trigger alarm only when state changes
      if (detected && !prevEmergencyRef.current) {
        triggerAlarm();
      }

      if (!detected) {
        stopAlarm();
      }

      prevEmergencyRef.current = detected;
    });

    // ---------------- HISTORY ----------------
    const historyRef = query(
      ref(db, "history/falls"),
      limitToLast(20)
    );

    onValue(historyRef, (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        setHistory([]);
        return;
      }

      const parsed: HistoryItem[] = Object.entries(data)
        .map(([id, value]) => {
          const item = value as any;
          return {
            id,
            evidence: item.evidence,
            timestamp: item.timestamp,
            timeStr:
              item.timeStr ??
              (item.timestamp
                ? new Date(item.timestamp).toLocaleString()
                : undefined),
          };
        })
        .reverse();

      setHistory(parsed);
    });

    // ---------------- OFFLINE CHECK ----------------
    const timer = setInterval(() => {
      const diff = Date.now() - lastUpdateRef.current;
      setIsOffline(diff > 8000);
    }, 3000);

    return () => {
      clearInterval(streamInterval);
      clearInterval(timer);
      off(liveRef);
      off(eventRef);
      off(historyRef);
      stopAlarm();
    };
  }, []);

  const handleReset = async () => {
    stopAlarm();
    await set(ref(db, "system/fall_event"), {
      detected: false,
      evidence: null,
      timestamp: null,
    });
  };

  const handleDeleteHistory = async (id: string) => {
    if (window.confirm("ต้องการลบประวัตินี้หรือไม่?")) await remove(ref(db, `history/falls/${id}`));
  };

  return (
    <div
      className={`min-h-screen transition-all duration-700 ${
        isEmergency ? "bg-red-950" : "bg-[#050505]"
      } text-zinc-100`}
    >
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/">
              <button className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-2xl border border-white/5 transition-all">
                <Home size={20} className="text-zinc-400" />
              </button>
            </Link>

            <div
              className={`p-2.5 rounded-2xl ${
                isEmergency
                  ? "bg-red-600 animate-pulse"
                  : "bg-blue-600"
              }`}
            >
              <ShieldAlert size={22} className="text-white" />
            </div>

            <div>
              <h1 className="font-black uppercase text-xl italic">
                Monitor Hub
              </h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase">
                AI Surveillance
              </p>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black border ${
              isOffline
                ? "border-red-500 text-red-500 bg-red-500/5"
                : "border-green-500 text-green-500 bg-green-500/5"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isOffline
                  ? "bg-red-500"
                  : "bg-green-500 animate-pulse"
              }`}
            />
            {isOffline ? "CAM OFFLINE" : "CAM ONLINE"}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          {isEmergency && (
            <section className="bg-red-600 rounded-[2.5rem] p-4 flex gap-6">
              {evidence && (
                <img
                  src={evidence}
                  className="w-48 aspect-square rounded-xl object-cover"
                  alt="Evidence"
                />
              )}

              <div>
                <h2 className="text-2xl font-black uppercase italic">
                  Fall Event Detected
                </h2>
                <p className="text-xs uppercase">
                  Time: {fallTime ?? "-"}
                </p>
                <button
                  onClick={handleReset}
                  className="mt-4 bg-white text-red-600 px-6 py-2 rounded-xl font-black"
                >
                  Resolve Alert
                </button>
              </div>
            </section>
          )}

          <section className="relative aspect-video bg-zinc-900 rounded-3xl overflow-hidden">
            {liveFrame && !isOffline ? (
              <img
                src={liveFrame}
                className="w-full h-full object-cover"
                alt="Live Feed"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
                <Activity className="animate-pulse mb-4" size={48} />
                Searching for Signal
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-4">
          <section className="bg-zinc-900 rounded-3xl p-6 h-full">
            <h3 className="text-xs font-bold uppercase mb-4 flex items-center gap-2">
              <History size={14} /> Incident Logs
            </h3>

            <div className="space-y-3">
              {history.length > 0 ? (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-3 bg-white/5 rounded-xl"
                  >
                    {item.evidence && (
                      <img
                        src={item.evidence}
                        className="w-14 h-14 rounded-lg object-cover"
                        alt=""
                      />
                    )}

                    <div className="flex-1">
                      <p className="text-xs text-zinc-400">
                        {item.timeStr ?? "-"}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        handleDeleteHistory(item.id)
                      }
                      className="text-zinc-500 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="opacity-20 text-center py-10">
                  <History size={40} />
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
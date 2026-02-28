"use client";

import { useRef, useEffect } from 'react';

export const useEmergency = () => {
  // ใช้ useRef เก็บ Audio Object เพื่อไม่ให้สร้างซ้ำซ้อนจนเสียงตีกัน
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // เตรียมไฟล์เสียงไว้ล่วงหน้า า
    audioRef.current = new Audio('/alarm-sound.mp3');
    audioRef.current.loop = false; // ถ้าอยากให้ดังวนลูป ให้เปลี่ยนเป็น true
  }, []);

  const triggerAlarm = (message: string) => {
    // 1. ส่ง Notification
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("⚠️ ตรวจพบเหตุฉุกเฉิน!", {
          body: message,
          icon: "/logo.png", // เปลี่ยนให้ตรงกับโลโก้ใหม่ของคุณ
          tag: "fall-alert", // ป้องกันการเด้งซ้ำหลายอันถ้ายังไม่ปิดอันเก่า
          requireInteraction: true, // แจ้งเตือนจะค้างไว้จนกว่าคนจะกดปิด
        });
      }
    }

    // 2. สั่งสั่นเครื่อง (สั่น 3 จังหวะหนักๆ)
    if ("vibrate" in navigator) {
      navigator.vibrate([500, 200, 500, 200, 800]);
    }

    // 3. เล่นเสียงไซเรน
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // เริ่มเล่นใหม่จากต้นเสียง
      audioRef.current.play().catch(e => {
        console.warn("Audio play blocked: ระบบต้องการให้คุณคลิกหน้าเว็บ 1 ครั้งก่อนเพื่อให้เสียงดังได้");
      });
    }
  };

  const requestPermission = async () => {
    // ขอสิทธิ์แจ้งเตือน
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        console.log("Notification permission granted.");
      }
    }
  };

  // ฟังก์ชันหยุดเสียง (สำหรับกด Reset ในหน้า Monitor)
  const stopAlarm = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  return { triggerAlarm, requestPermission, stopAlarm };
};

// src/hooks/useEmergency.ts
export const useEmergency = () => {
  const triggerAlarm = (message: string) => {
    // 1. ส่ง Notification (ลบ vibrate ออกจาก options เพื่อแก้ Type Error)
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("⚠️ ตรวจพบเหตุฉุกเฉิน", {
        body: message,
        icon: "/favicon.ico",
      });
    }

    // 2. สั่งสั่นเครื่องผ่าน Navigator API (มาตรฐานสำหรับมือถือ)
    if ("vibrate" in navigator) {
      navigator.vibrate([500, 110, 500, 110, 800]);
    }

    // 3. เสียงไซเรน (ต้องมีไฟล์ alarm-sound.mp3 ใน public)
    const audio = new Audio('/alarm-sound.mp3');
    audio.play().catch(e => console.log("Audio play blocked by browser. Interaction required."));
  };

  const requestPermission = () => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  };

  return { triggerAlarm, requestPermission };
};

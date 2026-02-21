// src/hooks/useEmergency.ts
export const useEmergency = () => {
  const triggerAlarm = (message: string) => {
    // 1. ส่ง Notification (ต้องขออนุญาต User ก่อน)
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("⚠️ ตรวจพบเหตุฉุกเฉิน", {
        body: message,
        icon: "/favicon.ico",
        vibrate: [200, 100, 200],
      });
    }

    // 2. สั่งสั่นเครื่อง (Vibration API)
    if ("vibrate" in navigator) {
      navigator.vibrate([500, 110, 500, 110, 800]); // รูปแบบสั่นเตือนภัย
    }

    // 3. ส่งเสียงไซเรน (Audio)
    const audio = new Audio('/alarm-sound.mp3');
    audio.play();
  };

  const requestPermission = () => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  };

  return { triggerAlarm, requestPermission };
};

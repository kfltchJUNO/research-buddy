"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export default function FileExpirationTimer({ expirationDate }: { expirationDate: Date }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = expirationDate.getTime() - now;

      if (distance < 0) {
        setTimeLeft("파일 파기됨");
        return;
      }

      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    const interval = setInterval(updateTimer, 1000);
    updateTimer(); // 초기 실행

    return () => clearInterval(interval);
  }, [expirationDate]);

  const isExpired = timeLeft === "파일 파기됨";

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-xs font-bold ${
      isExpired ? 'bg-gray-100 text-gray-400' : 'bg-orange-50 text-orange-600'
    }`}>
      <Clock size={14} />
      <span>{isExpired ? timeLeft : `파일 파기까지 ${timeLeft}`}</span>
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Props {
  targetDate: Date;
  onExpire?: () => void;
}

export default function CountdownTimer({ targetDate, onExpire }: Props) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTime = () => {
      const difference = targetDate.getTime() - new Date().getTime();
      if (difference <= 0) {
        setTimeLeft(0);
        onExpire?.();
        return;
      }
      setTimeLeft(difference);
    };

    const timer = setInterval(calculateTime, 1000);
    calculateTime(); // 초기 실행

    return () => clearInterval(timer);
  }, [targetDate, onExpire]);

  const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
  const seconds = Math.floor((timeLeft / 1000) % 60);

  if (timeLeft === 0) {
    return <span className="text-red-500 font-bold text-sm">원본 파기 완료</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center">
        <motion.span 
          key={seconds}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-sm font-mono font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded"
        >
          원본 파기까지 {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </motion.span>
      </div>
    </div>
  );
}
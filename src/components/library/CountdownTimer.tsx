"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface Props {
  targetDate?: Date; // 날짜가 없는 초기 상태를 고려하여 선택형으로 변경
  isDeleted?: boolean; // LibraryCard에서 전달하는 파기 여부 속성을 추가합니다.
  onExpire?: () => void;
}

export default function CountdownTimer({ targetDate, isDeleted, onExpire }: Props) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!targetDate || isDeleted) return; // 이미 파기된 파일은 타이머를 돌리지 않습니다.

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
    calculateTime();

    return () => clearInterval(timer);
  }, [targetDate, onExpire, isDeleted]);

  // 파기 완료 상태 처리
  if (isDeleted || (targetDate && timeLeft <= 0)) {
    return (
      <span className="text-gray-400 font-bold text-[11px] bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
        원본 파기 완료
      </span>
    );
  }

  if (!targetDate) return null;

  const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
  const seconds = Math.floor((timeLeft / 1000) % 60);

  return (
    <div className="flex items-center gap-2">
      <motion.span 
        key={seconds}
        initial={{ y: -3, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-[11px] font-mono font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-100 shadow-sm"
      >
        파기까지 {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </motion.span>
    </div>
  );
}
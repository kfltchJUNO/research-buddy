"use client";

import { motion } from "framer-motion";
import { reAnalyzeAction } from "@/app/actions/analyze-action";
import { useState } from "react";

export default function PerspectiveShiftUI({ docId, userId, originalMode }: any) {
  const [loading, setLoading] = useState(false);

  const options = [
    { id: 'critical', label: '비판적으로 보기', icon: '🔍' },
    { id: 'easy', label: '쉽게 설명해줘', icon: '💡' },
    { id: 'counter', label: '반박해보기', icon: '⚔️' },
    { id: 'alternative', label: '다른 이론으로 보기', icon: '🌈' },
  ];

  const handlePerspectiveShift = async (perspective: any) => {
    setLoading(true);
    const res = await reAnalyzeAction(userId, docId, perspective);
    if (res.success) {
      alert("관점 이동 완료! 새로운 통찰을 확인하세요.");
      window.location.reload(); // 간단하게 페이지 새로고침으로 반영
    } else {
      alert(res.message);
    }
    setLoading(false);
  };

  return (
    <div className="mt-12 p-8 bg-gray-50 rounded-3xl border border-gray-100">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h3 className="text-xl font-bold mb-1">관점을 이동해볼까요?</h3>
          <p className="text-sm text-gray-500">재분석 시 40% 할인된 Ink가 적용됩니다.</p>
        </div>
        {loading && <div className="text-blue-500 animate-pulse font-medium">새로운 관점으로 분석 중...</div>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {options.map((opt) => (
          <button
            key={opt.id}
            disabled={loading}
            onClick={() => handlePerspectiveShift(opt.id)}
            className="flex flex-col items-center p-4 bg-white border border-gray-200 rounded-2xl hover:border-black hover:shadow-md transition-all group"
          >
            <span className="text-2xl mb-2 group-hover:scale-125 transition-transform">{opt.icon}</span>
            <span className="text-sm font-bold">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
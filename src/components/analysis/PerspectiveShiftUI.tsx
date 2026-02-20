"use client";

import { motion } from "framer-motion";
import { reAnalyzeAction } from "@/app/actions/analyze-action";
import { useState } from "react";

interface Props {
  docId: string;
  userId: string;
  originalMode: string;
}

export default function PerspectiveShiftUI({ docId, userId, originalMode }: Props) {
  const [loading, setLoading] = useState(false);

  const options = [
    { id: 'critical', label: '비판적으로 보기', icon: '🔍' },
    { id: 'easy', label: '쉽게 설명해줘', icon: '💡' },
    { id: 'counter', label: '반박해보기', icon: '⚔️' },
    { id: 'alternative', label: '다른 이론으로 보기', icon: '🌈' },
  ];

  const handlePerspectiveShift = async (perspective: string) => {
    setLoading(true);
    // 버그 수정: 서버 액션의 정의 순서 (docId, userId, mode)를 정확히 준수합니다.
    const res = await reAnalyzeAction(docId, userId, perspective); 
    
    if (res.success) {
      alert("관점 이동 완료! 새로운 통찰을 확인하세요.");
      window.location.reload(); 
    } else {
      alert((res as any).message || "분석 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  return (
    <div className="mt-12 p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100 shadow-sm">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h3 className="text-xl font-bold mb-1 text-gray-900">관점을 이동해볼까요?</h3>
          <p className="text-sm text-gray-500 font-medium">
            재분석 시 <span className="text-violet-600 font-bold">40% 할인된 Ink</span>가 적용됩니다.
          </p>
        </div>
        {loading && <div className="text-violet-600 animate-pulse font-bold text-sm">새로운 관점으로 분석 중...</div>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {options.map((opt) => (
          <button
            key={opt.id}
            disabled={loading}
            onClick={() => handlePerspectiveShift(opt.id)}
            className="flex flex-col items-center p-5 bg-white border border-gray-200 rounded-2xl hover:border-violet-600 hover:shadow-lg transition-all group active:scale-95"
          >
            <span className="text-3xl mb-3 group-hover:scale-125 transition-transform duration-300">{opt.icon}</span>
            <span className="text-sm font-bold text-gray-700">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
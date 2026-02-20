"use client";

import { motion } from "framer-motion";
import { useState } from "react";

const DEPTH_OPTIONS = [
  { id: 'scan', label: '훑어보기', ink: 5, desc: '핵심 키워드와 1줄 요약 중심' },
  { id: 'understand', label: '제대로 이해', ink: 10, desc: '구조화된 요약과 핵심 개념 설명' },
  { id: 'think', label: '연구 수준 분석', ink: 15, desc: '비판적 분석, 한계점 및 후속 질문 제안' },
];

export default function DepthSelector({ onSelect, currentBalance }: any) {
  const [selected, setSelected] = useState('understand');

  return (
    <div className="mt-8 p-6 bg-white border rounded-2xl shadow-sm">
      <h3 className="text-lg font-bold mb-4">얼마나 깊게 볼까요?</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DEPTH_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSelected(opt.id)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              selected === opt.id ? 'border-black bg-gray-50' : 'border-gray-100 hover:border-gray-300'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold">{opt.label}</span>
              <span className="text-sm font-medium text-blue-600">🖋️ {opt.ink} Ink</span>
            </div>
            <p className="text-xs text-gray-500">{opt.desc}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-gray-500">현재 보유: {currentBalance} Ink</p>
        <button
          onClick={() => onSelect(selected)}
          disabled={currentBalance < DEPTH_OPTIONS.find(o => o.id === selected)!.ink}
          className="bg-black text-white px-8 py-3 rounded-full font-bold disabled:bg-gray-300"
        >
          분석 시작하기
        </button>
      </div>
    </div>
  );
}
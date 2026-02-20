"use client";

import React from "react";
import { useInk } from "@/hooks/useInk";
import { toast } from "react-hot-toast";

interface Props {
  cost: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function InkPaymentModal({ cost, onConfirm, onCancel }: Props) {
  const { inkBalance, isLoading } = useInk();
  const isShortage = inkBalance < cost;

  const handleConfirm = () => {
    if (isShortage) {
      toast.error("보유한 잉크가 부족합니다.");
      return;
    }
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm p-6 bg-white rounded-3xl shadow-xl border border-gray-100 animate-in zoom-in-95">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">🖋️</div>
          <h3 className="text-lg font-bold text-gray-900">잉크 결제 확인</h3>
        </div>
        <div className="bg-gray-50 rounded-2xl p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500 font-medium">소모 예정</span>
            <span className="font-bold text-violet-600">-{cost} Ink</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
            <span className="text-gray-500 font-medium">현재 보유</span>
            <span className={`font-bold ${isShortage ? 'text-red-500' : 'text-gray-900'}`}>
              {isLoading ? "확인 중..." : `${inkBalance.toLocaleString()} Ink`}
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl">취소</button>
          <button onClick={handleConfirm} className={`flex-1 py-3 text-sm font-bold text-white rounded-xl ${isShortage ? 'bg-gray-300 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700'}`}>
            {isShortage ? "충전 필요" : "잉크 사용하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
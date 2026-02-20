"use client";

import { useInk } from "@/hooks/useInk";
import { Zap } from "lucide-react";

interface Props {
  cost: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function InkPaymentModal({ cost, onConfirm, onCancel }: Props) {
  const { inkBalance } = useInk();
  const isShortage = inkBalance < cost;

  return (
    <div className="p-8 bg-white rounded-[2.5rem] border shadow-xl max-w-sm w-full">
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
          <Zap size={32} fill="currentColor" />
        </div>
      </div>

      <h3 className="text-2xl font-black text-center mb-2">분석을 시작할까요?</h3>
      <p className="text-center text-gray-500 text-sm mb-8 leading-relaxed">
        이 깊이의 분석에는 <span className="font-bold text-black">{cost} Ink</span>가 필요합니다.
      </p>

      <div className="bg-gray-50 p-4 rounded-2xl mb-8 flex justify-between items-center">
        <span className="text-sm font-bold text-gray-400">현재 보유 잉크</span>
        <span className="font-black text-lg">🖋️ {inkBalance}</span>
      </div>

      {isShortage ? (
        <div className="space-y-3">
          <p className="text-center text-red-500 text-xs font-bold mb-4">잉크가 부족합니다.</p>
          <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-colors">
            잉크 충전하러 가기
          </button>
          <button onClick={onCancel} className="w-full py-2 text-gray-400 font-bold text-sm">
            취소
          </button>
        </div>
      ) : (
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold">
            취소
          </button>
          <button onClick={onConfirm} className="flex-1 py-4 bg-black text-white rounded-2xl font-bold">
            확인
          </button>
        </div>
      )}
    </div>
  );
}
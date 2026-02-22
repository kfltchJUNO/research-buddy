"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { reAnalyzeAction } from "@/app/actions/analyze-action"; // 🚀 임포트 확인
import { RefreshCw, Lock, Sparkles, AlertCircle, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

interface Props {
  docId: string;
  userId: string;
  isDeleted: boolean;
  hasDeepInsight: boolean;
}

const PERSPECTIVES = [
  { id: 'critic', label: '비판적 허점 검증', icon: '🧐', desc: '논문의 방법론적 한계를 날카롭게 분석합니다.' },
  { id: 'rebuttal', label: '반박 시나리오', icon: '🥊', desc: '이 연구에 반대하는 가상의 논리를 구축합니다.' },
  { id: 'easy', label: '쉬운 개념 설명', icon: <Sparkles size={16}/>, desc: '중학생도 이해할 수 있게 비유로 설명합니다.' }
];

export default function PerspectiveShiftUI({ docId, userId, isDeleted, hasDeepInsight }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleShift = async (perspective: string) => {
    if (isDeleted) return toast.error("파일이 파기되어 새로운 분석이 불가능합니다.");
    
    setLoading(true);
    const loadingToast = toast.loading(`${perspective} 관점으로 사고를 확장 중...`);
    
    try {
      const res = await reAnalyzeAction(docId, perspective, userId);
      if (res.success && res.data) {
        toast.success("새로운 인사이트가 추가되었습니다!", { id: loadingToast });
        router.refresh(); // 데이터 갱신
      } else {
        toast.error(res.message || "분석 실패", { id: loadingToast });
      }
    } catch (err) {
      toast.error("통신 장애 발생", { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-12 space-y-6">
      {/* 🧠 1. 인지 격차 노출 (Cliffhanger) 섹션 */}
      {!hasDeepInsight && !isDeleted && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden group p-10 border-2 border-dashed border-violet-200 rounded-[3rem] bg-white"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-violet-50/50 to-transparent pointer-events-none" />
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-violet-600 text-white rounded-2xl shadow-xl flex items-center justify-center mb-6 group-hover:rotate-12 transition-transform">
              <Lock size={32} />
            </div>
            
            <h4 className="text-2xl font-black text-gray-900 mb-3 tracking-tighter italic">
              "잠시만요, 이 논문의 결론을 그대로 믿으시겠습니까?"
            </h4>
            
            <p className="text-sm font-bold text-gray-500 mb-8 max-w-md leading-relaxed">
              현재 분석 단계에서는 가려진 <span className="text-violet-600 underline decoration-2 underline-offset-4">데이터 조작 가능성</span> 및 <span className="text-violet-600">방법론적 결함</span>이 감지되었습니다. 
              연구자님의 완벽한 이해를 위해 '비판적 검증'이 필요합니다.
            </p>

            <button 
              onClick={() => handleShift('비판적 허점 검증')}
              disabled={loading}
              className="flex items-center gap-3 px-8 py-4 bg-black text-white rounded-2xl font-black text-lg hover:bg-violet-600 hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-gray-300 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw size={20}/>}
              허점 검증하고 이해도 완성하기 (8 Ink)
            </button>
          </div>

          {/* 배경 장식 텍스트 */}
          <div className="absolute -bottom-4 -right-4 opacity-5 pointer-events-none select-none text-8xl font-black italic">
            CRITICAL
          </div>
        </motion.div>
      )}

      {/* 🔄 2. 관점 전환 (Identity 강화) 섹션 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PERSPECTIVES.slice(1).map((p) => (
          <button
            key={p.id}
            onClick={() => handleShift(p.label as string)}
            disabled={isDeleted || loading}
            className={`flex items-center justify-between p-6 rounded-3xl border-2 transition-all text-left group
              ${isDeleted ? 'bg-gray-50 border-gray-100 opacity-50' : 'bg-white border-gray-100 hover:border-violet-300 hover:shadow-xl'}
            `}
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl group-hover:scale-110 transition-transform">{p.icon}</div>
              <div>
                <div className="font-black text-gray-900 mb-0.5">{p.label}</div>
                <div className="text-[11px] font-bold text-gray-400">{p.desc}</div>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-300 group-hover:text-violet-600 group-hover:translate-x-1 transition-all" />
          </button>
        ))}
      </div>

      {isDeleted && (
        <div className="flex items-center justify-center gap-2 p-4 bg-red-50 text-red-500 rounded-2xl border border-red-100 animate-in fade-in">
          <AlertCircle size={16} />
          <span className="text-xs font-black uppercase tracking-widest">Original data purged. New analysis restricted.</span>
        </div>
      )}
    </div>
  );
}

function Loader2(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-loader-2 animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
  )
}
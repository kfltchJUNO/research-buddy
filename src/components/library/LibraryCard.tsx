"use client";

import React from "react";
import Link from "next/link";
import { Clock, Star, ArrowRight, Zap, Target, ShieldCheck } from "lucide-react";
import CountdownTimer from "./CountdownTimer";

interface LibraryCardProps {
  item: any;
  // ✅ 아래 한 줄을 추가하여 TypeScript에게 알려줍니다.
  onFavoriteToggle?: () => void | Promise<void>; // page.tsx에서 전달한 데이터
}

export default function LibraryCard({ item }: LibraryCardProps) {
  // 모드별 색상 정의
  const modeConfig: any = {
    scan: { label: "Scan", color: "bg-amber-100 text-amber-700", icon: <Zap size={12} /> },
    understand: { label: "Understand", color: "bg-emerald-100 text-emerald-700", icon: <Target size={12} /> },
    think: { label: "Think", color: "bg-violet-100 text-violet-700", icon: <Star size={12} fill="currentColor" /> },
    multi: { label: "Multi", color: "bg-indigo-600 text-white", icon: <Zap size={12} /> }
  };

  const config = modeConfig[item.mode] || modeConfig.scan;

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group overflow-hidden flex flex-col h-full">
      {/* 카드 상단: 모드 배지 및 즐겨찾기 */}
      <div className="p-8 pb-4 flex justify-between items-start">
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${config.color}`}>
          {config.icon} {config.label}
        </div>
        <button className={`p-2 rounded-xl transition-all ${item.isFavorite ? 'text-amber-400 bg-amber-50' : 'text-gray-200 hover:text-gray-400'}`}>
          <Star size={20} fill={item.isFavorite ? "currentColor" : "none"} />
        </button>
      </div>

      {/* 카드 중단: 제목 및 분석 요약 */}
      <div className="px-8 flex-1">
        <Link href={`/analysis/${item.id}`} className="block mb-4">
          <h3 className="text-xl font-black text-gray-900 leading-tight line-clamp-2 group-hover:text-violet-600 transition-colors">
            {item.title}
          </h3>
        </Link>
        <p className="text-gray-400 text-sm font-medium line-clamp-2 mb-6">
          {item.oneLineSummary || "분석 요약을 불러오는 중입니다..."}
        </p>

        {/* 📊 신뢰도 지표 시각화 (Reliability Index) */}
        {item.reliability_index && (
          <div className="mb-6 p-4 bg-gray-50 rounded-2xl space-y-3">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tighter">
              <span className="text-violet-600">인용 비율 {item.reliability_index.citation_ratio}%</span>
              <span className="text-gray-400">해석 비율 {item.reliability_index.interpretation_ratio}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden flex">
              <div 
                className="h-full bg-violet-600 transition-all duration-1000" 
                style={{ width: `${item.reliability_index.citation_ratio}%` }} 
              />
              <div 
                className="h-full bg-indigo-200 transition-all duration-1000" 
                style={{ width: `${item.reliability_index.interpretation_ratio}%` }} 
              />
            </div>
          </div>
        )}
      </div>

      {/* 카드 하단: 파기 카운트다운 및 링크 */}
      <div className="p-8 pt-0 mt-auto">
        <div className="flex items-center justify-between pt-6 border-t border-gray-50">
          <div className="flex flex-col gap-1">
            {/* ✅ 수정: 데이터 존재 여부를 안전하게 확인하여 .toDate() 에러 방지 */}
            {item.fileDeletedAt ? (
              <CountdownTimer 
                targetDate={item.fileDeletedAt?.toDate ? item.fileDeletedAt.toDate() : new Date(item.fileDeletedAt)} 
                isDeleted={item.isSourceDeleted}
              />
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-300">
                <ShieldCheck size={12} /> 보안 기록 완료
              </div>
            )}
            <span className="text-[10px] text-gray-300 font-bold flex items-center gap-1">
              <Clock size={10} /> 
              {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : '데이터 로딩 중...'}
            </span>
          </div>

          <Link 
            href={`/analysis/${item.id}`} 
            className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center hover:bg-violet-600 transition-all shadow-lg"
          >
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
"use client";

import { motion } from "framer-motion";
import { Star, Clock, FileText, ChevronRight } from "lucide-react";
import CountdownTimer from "./CountdownTimer"; // 지난번 구현한 타이머 사용
import Link from "next/link";

export default function LibraryCard({ item, onFavoriteToggle }: any) {
  const modeColors: any = {
    scan: "bg-blue-50 text-blue-600",
    understand: "bg-purple-50 text-purple-600",
    think: "bg-orange-50 text-orange-600",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group bg-white border border-gray-100 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:border-black hover:shadow-xl transition-all cursor-pointer relative"
    >
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest ${modeColors[item.mode]}`}>
            {item.mode}
          </span>
          <h3 className="font-black text-xl text-gray-900 group-hover:text-blue-600 transition-colors">
            {item.title}
          </h3>
        </div>
        
        <p className="text-gray-500 line-clamp-1 text-sm font-medium">
          {item.oneLineSummary || "요약 내용을 불러올 수 없습니다."}
        </p>

        <div className="flex flex-wrap gap-2">
          {item.keywords?.map((kw: string) => (
            <span key={kw} className="text-[11px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
              #{kw}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0">
        <div className="flex flex-col items-end gap-1">
          <CountdownTimer 
            targetDate={item.fileDeletedAt?.toDate()} 
            isDeleted={item.isSourceDeleted}
          />
          <span className="text-[10px] text-gray-300 font-medium flex items-center gap-1">
            <Clock size={10} /> {item.createdAt?.toDate().toLocaleDateString()} 분석
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              onFavoriteToggle();
            }}
            className={`p-3 rounded-2xl transition-all ${
              item.isFavorite ? 'bg-yellow-100 text-yellow-500' : 'bg-gray-50 text-gray-300 hover:text-yellow-500'
            }`}
          >
            <Star size={20} fill={item.isFavorite ? "currentColor" : "none"} />
          </button>
          
          <Link href={`/analysis/${item.id}`} className="p-3 bg-black text-white rounded-2xl hover:scale-105 transition-transform">
            <ChevronRight size={20} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
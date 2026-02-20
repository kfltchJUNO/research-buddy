"use client";

import { motion } from "framer-motion";
import { Star, Clock, FileText, ChevronRight } from "lucide-react";
import CountdownTimer from "./CountdownTimer";
import Link from "next/link";

export default function LibraryCard({ item, onFavoriteToggle }: any) {
  const modeColors: any = {
    scan: "bg-blue-50 text-blue-600",
    understand: "bg-purple-50 text-purple-600",
    think: "bg-orange-50 text-orange-600",
    multi: "bg-violet-50 text-violet-600",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group bg-white border border-gray-100 p-6 rounded-[2rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:border-violet-600 hover:shadow-xl transition-all relative"
    >
      <Link href={`/analysis/${item.id}`} className="flex-1 space-y-3 w-full">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${modeColors[item.mode]}`}>
            {item.mode}
          </span>
          <h3 className="font-black text-lg text-gray-900 group-hover:text-violet-600 transition-colors line-clamp-1">
            {item.title}
          </h3>
        </div>
        
        <p className="text-gray-500 line-clamp-1 text-sm font-medium">
          {item.oneLineSummary || "분석 내용을 불러오는 중입니다..."}
        </p>

        <div className="flex flex-wrap gap-2">
          {item.keywords?.map((kw: string) => (
            <span key={kw} className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
              #{kw}
            </span>
          ))}
        </div>
      </Link>

      <div className="flex items-center justify-between w-full md:w-auto gap-6 border-t md:border-t-0 pt-4 md:pt-0">
        <div className="flex flex-col items-end gap-1.5">
          <CountdownTimer 
            targetDate={item.fileDeletedAt?.toDate()} 
            isDeleted={item.isSourceDeleted}
          />
          <span className="text-[10px] text-gray-300 font-bold flex items-center gap-1">
            <Clock size={10} /> {item.createdAt?.toDate().toLocaleDateString()} 분석
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.preventDefault(); // 링크 이동 방지
              e.stopPropagation();
              onFavoriteToggle();
            }}
            className={`p-3 rounded-2xl transition-all ${
              item.isFavorite ? 'bg-yellow-100 text-yellow-500' : 'bg-gray-50 text-gray-300 hover:text-yellow-500'
            }`}
          >
            <Star size={20} fill={item.isFavorite ? "currentColor" : "none"} />
          </button>
          
          <Link href={`/analysis/${item.id}`} className="p-3 bg-gray-900 text-white rounded-2xl hover:bg-black transition-colors">
            <ChevronRight size={20} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
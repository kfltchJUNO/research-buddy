"use client";

import { motion } from "framer-motion";
import { fadeInSlideUp, staggerContainer } from "@/lib/animations";

interface Props {
  data: {
    keywords: string[];
    oneLineSummary: string;
  };
}

export default function QuickScanResult({ data }: Props) {
  return (
    <motion.div 
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      {/* 1줄 요약 애니메이션 */}
      <motion.div variants={fadeInSlideUp} className="text-center">
        <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider">3-Sec Scan</span>
        <h2 className="text-2xl font-bold mt-2 text-gray-900 leading-tight">
          "{data.oneLineSummary}"
        </h2>
      </motion.div>

      {/* 키워드들이 하나씩 등장 */}
      <motion.div 
        variants={staggerContainer}
        className="flex flex-wrap justify-center gap-3"
      >
        {data.keywords.map((kw, index) => (
          <motion.span
            key={index}
            variants={fadeInSlideUp}
            whileHover={{ scale: 1.05 }} // 살짝 커지는 효과
            className="px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm text-gray-700 font-medium"
          >
            #{kw}
          </motion.span>
        ))}
      </motion.div>
    </motion.div>
  );
}
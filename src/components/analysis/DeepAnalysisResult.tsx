"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function DeepAnalysisResult({ summary, citations }: any) {
  const [showCitations, setShowCitations] = useState(false);

  return (
    <div className="bg-white border rounded-2xl p-8 shadow-sm">
      <div className="prose max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap">
        {summary}
      </div>

      <div className="mt-10 border-t pt-6">
        <button 
          onClick={() => setShowCitations(!showCitations)}
          className="text-sm font-bold text-gray-500 hover:text-black transition-colors flex items-center gap-2"
        >
          {showCitations ? "↑ 근거 숨기기" : "↓ 이 결과의 근거 보기 (신뢰도 포함)"}
        </button>

        {/* 근거 문장 부드럽게 펼쳐지기 */}
        <AnimatePresence>
          {showCitations && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-6 space-y-4 bg-gray-50 p-6 rounded-xl border border-gray-100">
                {citations.map((c: any, i: number) => (
                  <div key={i} className="text-sm text-gray-600 italic">
                    <span className="font-bold text-blue-500 mr-2">p.{c.page}</span>
                    "{c.text}"
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
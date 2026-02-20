"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { FileText, ShieldCheck, Quote, Lightbulb } from "lucide-react";
import AnalysisChart from "@/components/analysis/AnalysisChart";
import PerspectiveShiftUI from "@/components/analysis/PerspectiveShiftUI";
import FileExpirationTimer from "@/components/library/FileExpirationTimer";

export default function AnalysisDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const snap = await getDoc(doc(db, "knowledge_library", params.id));
      if (snap.exists()) setData(snap.data());
    };
    fetchData();
  }, [params.id]);

  if (!data) return <div className="p-20 text-center animate-pulse">분석 결과를 불러오는 중...</div>;

  return (
    <main className="max-w-4xl mx-auto pt-32 pb-20 px-6">
      {/* 1. 헤더: 제목 및 파기 타이머 */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="mb-12 border-b pb-8"
      >
        <div className="flex justify-between items-start mb-4">
          <span className="px-4 py-1.5 bg-black text-white rounded-full text-xs font-black uppercase tracking-widest">
            {data.mode} Mode
          </span>
          <FileExpirationTimer expirationDate={data.fileDeletedAt?.toDate()} />
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-4">{data.title}</h1>
        <p className="text-xl text-blue-600 font-bold leading-relaxed">
          "{data.oneLineSummary}"
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* 좌측: 메인 분석 리포트 (2열 차지) */}
        <div className="md:col-span-2 space-y-12">
          {/* 요약 본문 */}
          <section>
            <h3 className="flex items-center gap-2 text-lg font-black mb-6">
              <FileText size={20} className="text-blue-500" /> 분석 리포트
            </h3>
            <div className="prose prose-blue max-w-none text-gray-700 leading-loose whitespace-pre-wrap bg-white p-8 rounded-[2rem] border shadow-sm">
              {data.summary || "상세 분석을 진행하면 이곳에 풍부한 요약 내용이 표시됩니다."}
            </div>
          </section>

          {/* 인용 및 근거 */}
          {data.citations && (
            <section>
              <h3 className="flex items-center gap-2 text-lg font-black mb-6">
                <Quote size={20} className="text-purple-500" /> 핵심 근거 (Citations)
              </h3>
              <div className="space-y-4">
                {data.citations.map((c: any, i: number) => (
                  <div key={i} className="bg-purple-50/50 p-6 rounded-2xl border border-purple-100">
                    <p className="text-gray-800 italic mb-2">"{c.text}"</p>
                    <span className="text-xs font-bold text-purple-400">Page {c.page}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* 우측: 시각화 및 부가 정보 (1열 차지) */}
        <div className="space-y-8">
          {/* 시각화 차트 */}
          <AnalysisChart data={data.visualData} />

          {/* 신뢰도 지표 */}
          <div className="bg-gray-900 text-white p-6 rounded-[2rem] shadow-xl">
            <h4 className="flex items-center gap-2 text-sm font-bold mb-4 opacity-70">
              <ShieldCheck size={16} /> 분석 신뢰도
            </h4>
            <div className="text-3xl font-black mb-2">{data.trustLevel}</div>
            <p className="text-xs text-gray-400 leading-relaxed mb-6">{data.trustDescription}</p>
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold">
                <span>원문 인용</span>
                <span>{data.citationRatio}%</span>
              </div>
              <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full" style={{ width: `${data.citationRatio}%` }} />
              </div>
            </div>
          </div>

          {/* 후속 질문 */}
          {data.researchQuestions && (
            <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
              <h4 className="flex items-center gap-2 text-sm font-black text-blue-600 mb-4">
                <Lightbulb size={16} /> 후속 연구 질문
              </h4>
              <ul className="space-y-3">
                {data.researchQuestions.map((q: string, i: number) => (
                  <li key={i} className="text-xs font-bold text-blue-800 leading-relaxed">• {q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 하단: 관점 이동 (재분석) UI */}
      <PerspectiveShiftUI docId={params.id} userId={data.userId} originalMode={data.mode} />
    </main>
  );
}
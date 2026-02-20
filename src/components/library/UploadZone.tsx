"use client";

import React, { useState } from "react";
import { startQuickScan } from "@/app/actions/analyze-action";
import { auth } from "@/lib/firebase";
import { toast } from "react-hot-toast";

// 분석 결과의 타입을 정의하여 타입스크립트 에러 방지
interface AnalysisResult {
  keywords: string[];
  oneLineSummary: string;
  docId: string;
}

export default function UploadZone() {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const user = auth.currentUser;

    if (!file) return;
    if (!user) {
      toast.error("로그인이 필요한 서비스입니다.");
      return;
    }

    setIsScanning(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", user.uid);

    try {
      const res = await startQuickScan(formData);

      if (res.success && res.data) {
        // 서버에서 반환한 data를 AnalysisResult 타입으로 확정하여 저장
        setResult(res.data as AnalysisResult);
        toast.success("논문 분석이 완료되었습니다!");
      } else {
        toast.error(res.message || "분석 중 오류가 발생했습니다.");
      }
    } catch (error) {
      console.error(error);
      toast.error("서버와 통신하는 중 문제가 발생했습니다.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-8 border-2 border-dashed rounded-2xl border-violet-200 bg-white shadow-sm hover:border-violet-400 transition-colors">
      <div className="flex flex-col items-center gap-6 text-center">
        <h2 className="text-2xl font-extrabold text-gray-900">이 논문, 어디까지 이해하고 싶으세요?</h2>
        <p className="text-gray-500 italic">“우리는 답이 아니라, 생각을 만듭니다.”</p>
        
        <label className="cursor-pointer w-full">
          <input 
            type="file" 
            onChange={handleFileChange} 
            disabled={isScanning}
            className="hidden"
          />
          <div className="py-4 px-6 bg-violet-50 text-violet-700 rounded-xl font-semibold border border-violet-100 hover:bg-violet-100 transition-all">
            {isScanning ? "⚡ 분석 중..." : "📄 분석할 논문 파일 선택"}
          </div>
        </label>

        {isScanning && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-violet-600 font-medium">Gemini가 분석 리포트를 생성하고 있습니다...</p>
          </div>
        )}

        {result && (
          <div className="mt-6 p-6 bg-gray-50 rounded-2xl w-full text-left border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-xl">💡</span> 핵심 요약 리포트
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">{result.oneLineSummary}</p>
            <div className="flex flex-wrap gap-2">
              {result.keywords.map((kw, i) => (
                <span key={i} className="px-3 py-1 bg-white text-violet-600 text-sm font-medium rounded-full border border-violet-100 shadow-sm">
                  #{kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
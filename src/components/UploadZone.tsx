// src/components/UploadZone.tsx (클라이언트 컴포넌트)
"use client";

import { useState } from "react";
import { startQuickScan } from "@/app/actions/analyze-action";

export default function UploadZone() {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<{keywords: string[], oneLineSummary: string} | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await startQuickScan(formData);
      setResult(res.data);
    } catch (error) {
      alert("분석 중 오류가 발생했습니다.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="w-full">
      <div className="border-2 border-dashed p-10 rounded-xl text-center">
        {isScanning ? (
          <p className="animate-pulse">논문을 읽는 중입니다... (3초만 기다려주세요) 🖋️</p>
        ) : (
          <input type="file" onChange={handleFileChange} accept=".pdf" />
        )}
      </div>

      {result && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg animate-in fade-in slide-in-from-bottom-4">
          <h3 className="font-bold text-lg mb-2">✨ 3초 스캔 결과</h3>
          <p className="text-blue-600 font-medium mb-3">"{result.oneLineSummary}"</p>
          <div className="flex flex-wrap gap-2">
            {result.keywords.map((kw) => (
              <span key={kw} className="bg-white px-3 py-1 rounded-full border text-sm">
                #{kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
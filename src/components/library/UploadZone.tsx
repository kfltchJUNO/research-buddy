"use client";

import React, { useState } from "react";
import { startQuickScan } from "@/app/actions/analyze-action";
import { auth } from "@/lib/firebase";
import { toast } from "react-hot-toast";

export default function UploadZone() {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 이 시점에서 auth.currentUser가 없으면 실제 세션이 끊긴 것입니다.
    const user = auth.currentUser; 

    if (!file) return;
    if (!user) {
      toast.error("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
      return;
    }

    setIsScanning(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", user.uid);

    try {
      const res = await startQuickScan(formData);

      if (res.success) {
        setResult(res.data);
        toast.success("분석이 완료되었습니다!");
      } else {
        toast.error(res.message || "분석 중 오류가 발생했습니다.");
      }
    } catch (error) {
      toast.error("통신 중 오류가 발생했습니다.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="w-full p-10 border-2 border-dashed border-violet-200 rounded-[3rem] bg-white text-center">
      <input type="file" id="file-upload" className="hidden" onChange={handleFileChange} disabled={isScanning} />
      <label htmlFor="file-upload" className="cursor-pointer">
        <div className="py-5 px-10 bg-violet-600 text-white rounded-2xl font-bold hover:bg-violet-700 transition-all inline-block">
          {isScanning ? "⚡ 분석 중..." : "📄 분석할 논문 선택"}
        </div>
      </label>
      {isScanning && <p className="mt-4 text-violet-600 animate-pulse font-medium">Gemini가 리포트를 생성하고 있습니다...</p>}
      
      {/* 결과 리포트 표시 (생략) */}
    </div>
  );
}
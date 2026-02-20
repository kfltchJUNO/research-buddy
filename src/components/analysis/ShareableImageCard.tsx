"use client";

import { useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { saveAs } from "file-saver";
import { Share2, Download } from "lucide-react";

interface Props {
  title: string;
  oneLineSummary: string;
  keywords: string[];
}

export default function ShareableImageCard({ title, oneLineSummary, keywords }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAndDownloadImage = async () => {
    if (!cardRef.current) return;
    setIsGenerating(true);
    try {
      const blob = await toBlob(cardRef.current, { quality: 0.95, pixelRatio: 3 }); // 고해상도 설정
      if (blob) {
        saveAs(blob, `ResearchBuddy_요약카드_${title.slice(0, 10)}.png`);
      }
    } catch (err) {
      console.error("이미지 생성 실패:", err);
      alert("이미지 카드 생성에 실패했습니다.");
    }
    setIsGenerating(false);
  };

  return (
    <div className="mt-8">
      {/* 1. 실제 화면에 보이는 다운로드 버튼 */}
      <button
        onClick={generateAndDownloadImage}
        disabled={isGenerating}
        className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-colors disabled:bg-gray-400 ml-auto"
      >
        {isGenerating ? <span className="animate-pulse">생성 중...</span> : <><Share2 size={18} /> 이미지 카드로 공유</>}
      </button>

      {/* 2. 숨겨진 이미지 생성용 원본 HTML (화면 밖으로 숨김) */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div 
          ref={cardRef}
          className="w-[600px] h-[600px] bg-gradient-to-br from-gray-50 to-white p-10 flex flex-col justify-between border-4 border-black relative overflow-hidden font-sans text-gray-900"
        >
          {/* 배경 장식 */}
          <div className="absolute top-0 right-0 text-[200px] opacity-5 select-none">🖋️</div>
          
          <div>
            <div className="flex items-center gap-2 mb-6 opacity-50">
              <span className="text-2xl">🖋️</span>
              <span className="font-black text-xl tracking-tighter">ResearchBuddy</span>
            </div>
            
            <h1 className="text-3xl font-black leading-tight mb-8 line-clamp-3">
              {title}
            </h1>

            <div className="bg-black p-6">
              <span className="text-white font-medium block mb-2 opacity-70">결국 이 연구는,</span>
              <p className="text-white text-2xl font-bold leading-relaxed">
                "{oneLineSummary}"
              </p>
              <span className="text-white font-medium block mt-2 opacity-70">를 말합니다.</span>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap gap-2 mb-6">
              {keywords.slice(0, 3).map((kw, i) => (
                <span key={i} className="px-3 py-1 bg-white border-2 border-black rounded-full text-sm font-bold">
                  #{kw}
                </span>
              ))}
            </div>
            <p className="text-right text-sm font-bold opacity-50">
              생각의 깊이를 조절하는 도구, 리서치버디에서 생성됨.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
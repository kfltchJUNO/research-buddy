"use client";

import { useState, useCallback } from "react";
import { auth } from "@/lib/firebase";
import { runUnifiedAnalysisAction } from "@/app/actions/analyze-action";
import { toast } from "react-hot-toast";
import { UploadCloud, FileText, Zap, Target, Brain, Sparkles, X, Loader2, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const COSTS = {
  single: { scan: 5, understand: 10, think: 15 },
  multi: { scan: 15, understand: 25, think: 40 }
};

export default function UnifiedAnalyzer() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<'scan' | 'understand' | 'think'>('scan');
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 예상 잉크 실시간 계산
  const isMulti = files.length > 1;
  const currentCost = files.length > 0 ? (isMulti ? COSTS.multi[mode] : COSTS.single[mode]) : 0;

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const uploaded = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
    if (files.length + uploaded.length > 10) return toast.error("최대 10개까지 가능합니다.");
    setFiles(prev => [...prev, ...uploaded]);
  }, [files]);

  const handleStart = async () => {
  if (files.length === 0) return toast.error("파일을 먼저 업로드해 주세요.");
  const user = auth.currentUser;
  if (!user) return toast.error("로그인이 필요합니다.");

  setLoading(true);
  const formData = new FormData();
  formData.append("userId", user.uid);
  formData.append("mode", mode);
  files.forEach(f => formData.append("files", f));

  try {
    const res = await runUnifiedAnalysisAction(formData);
    
    // res가 undefined이거나 success가 false인 경우 처리
    if (res && res.success && res.data) {
      toast.success("분석이 성공적으로 완료되었습니다!");
      window.location.href = `/analysis/${res.data.docId}`;
    } else {
      // 서버에서 전달한 구체적인 에러 메시지 표출
      toast.error(res?.message || "분석 도중 오류가 발생했습니다.");
    }
  } catch (err) {
    // 네트워크 단절 등 물리적인 통신 오류 시
    console.error("Client Communication Error:", err);
    toast.error("서버와 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* 1. 업로드 영역 */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`p-16 border-4 border-dashed rounded-[4rem] transition-all text-center relative ${
          isDragging ? 'border-violet-600 bg-violet-50 scale-[1.02]' : 'border-gray-100 bg-white shadow-sm'
        }`}
      >
        <input type="file" id="unified-input" className="hidden" multiple accept=".pdf" onChange={(e) => e.target.files && setFiles(prev => [...prev, ...Array.from(e.target.files!)])} />
        <label htmlFor="unified-input" className="cursor-pointer block">
          <UploadCloud size={64} className={`mx-auto mb-6 ${isDragging ? 'text-violet-600' : 'text-gray-300'}`} />
          <p className="text-2xl font-black text-gray-900 tracking-tighter">연구 자료를 여기에 던져주세요</p>
          <p className="text-gray-400 font-bold mt-2 uppercase tracking-widest text-xs">최대 10개 | PDF 전용</p>
        </label>

        {files.length > 0 && (
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-2xl text-[11px] font-black italic shadow-lg">
                <FileText size={14} className="text-violet-400" /> {f.name.slice(0, 15)}...
                <X size={14} className="ml-2 cursor-pointer hover:text-red-400" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. 통합 사고 조절기 */}
      <div className="bg-white p-12 rounded-[4rem] border border-gray-50 shadow-xl shadow-gray-100/50">
        <div className="flex justify-between items-center mb-10">
          <h3 className="text-2xl font-black text-gray-900 italic tracking-tighter flex items-center gap-3">
            <Sparkles className="text-violet-600" /> 생각의 깊이를 조절하세요
          </h3>
          <div className="bg-violet-50 text-violet-600 px-5 py-2 rounded-2xl font-black text-xs border border-violet-100 uppercase tracking-widest">
            {files.length > 1 ? `MULTI (${files.length})` : 'SINGLE'} ANALYSIS
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { id: 'scan', label: 'Scan', icon: Zap, desc: '핵심만 콕콕 요약된 리포트가 나옵니다.', color: 'text-amber-500', level: '빠른 흐름 파악' },
            { id: 'understand', label: 'Understand', icon: Target, desc: '구조화된 요약과 핵심 개념을 설명합니다.', color: 'text-emerald-500', level: '체계적 내용 이해' },
            { id: 'think', label: 'Think', icon: Brain, desc: '한계점과 비판적 사고, 후속 질문을 제안합니다.', color: 'text-violet-500', level: '심층적 비판 사고' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id as any)}
              className={`p-8 rounded-[3rem] border-2 text-left transition-all relative group ${
                mode === m.id ? 'border-gray-900 bg-gray-50 shadow-inner' : 'border-gray-50 hover:border-gray-200'
              }`}
            >
              <m.icon size={32} className={`${m.color} mb-6 transition-transform group-hover:scale-110`} />
              <div className="font-black text-xl text-gray-900 mb-1 italic tracking-tighter">{m.label}</div>
              <div className="text-[10px] font-bold text-gray-400 mb-4 uppercase tracking-widest">{m.level}</div>
              <p className="text-[11px] text-gray-400 font-bold leading-relaxed">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 3. 승인 및 비용 확인 */}
      <div className="flex flex-col items-center gap-8 bg-gray-900 p-12 rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10 font-black text-9xl italic select-none">INK</div>
        <div className="z-10 text-center">
          <span className="text-gray-400 font-black text-[10px] uppercase tracking-[0.4em] mb-4 block">Approval Required</span>
          <div className="text-7xl font-black tracking-tighter italic flex items-center justify-center gap-4">
             <span className="text-violet-500">🖋️</span> {currentCost} <span className="text-2xl text-gray-500 font-medium">Ink</span>
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={loading || files.length === 0}
          className="z-10 w-full max-w-xl bg-violet-600 text-white py-8 rounded-[2.5rem] font-black text-2xl hover:bg-white hover:text-black active:scale-95 transition-all disabled:bg-gray-800 disabled:text-gray-600 shadow-2xl flex items-center justify-center gap-4 group"
        >
          {loading ? (
            <><Loader2 className="animate-spin" size={32} /> AI가 사고를 확장하는 중...</>
          ) : (
            <><Sparkles size={32} className="group-hover:rotate-12 transition-transform" /> 분석 승인 및 시작</>
          )}
        </button>

        <p className="z-10 flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
          <Info size={14} className="text-violet-500" />
          데이터는 1시간 후 영원히 소멸됩니다.
        </p>
      </div>
    </div>
  );
}
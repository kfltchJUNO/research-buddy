"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, BookOpen, FileText, ShieldAlert, Zap, BrainCircuit, Microscope } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function AnalysisResultPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const docId = params.id as string;

  useEffect(() => {
    const fetchResult = async () => {
      if (!docId) return;
      try {
        const docRef = doc(db, "knowledge_library", docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setData(docSnap.data());
        } else {
          toast.error("분석 결과를 찾을 수 없습니다.");
          router.push("/");
        }
      } catch (error) {
        toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [docId, router]);

  if (loading) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center bg-[#F9FAFB]">
        <Loader2 className="animate-spin text-violet-600 mb-4" size={40} />
        <p className="text-gray-500 font-bold">분석 리포트를 생성하는 중입니다...</p>
      </div>
    );
  }

  if (!data) return null;

  // 파일 파기 시간 계산 (생성 시간 + 1시간)
  const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
  const deletionTime = new Date(createdAt.getTime() + 60 * 60 * 1000);
  const formattedDeletionTime = deletionTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const modeInfo = {
    scan: { label: "Quick Scan", icon: <Zap size={16} />, color: "text-blue-600 bg-blue-50 border-blue-100" },
    understand: { label: "Understand", icon: <BrainCircuit size={16} />, color: "text-green-600 bg-green-50 border-green-100" },
    think: { label: "Deep Think", icon: <Microscope size={16} />, color: "text-violet-600 bg-violet-50 border-violet-100" },
  };
  const currentMode = modeInfo[data.mode as keyof typeof modeInfo] || modeInfo.scan;

  return (
    <main className="pt-28 pb-32 px-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      
      {/* 🔙 상단 네비게이션 */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors font-bold text-sm">
          <ArrowLeft size={16} /> 새로운 분석하기
        </button>
        <Link href="/library" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-violet-600 transition-colors shadow-lg">
          <BookOpen size={14} /> 내 연구 기록 보기
        </Link>
      </div>

      {/* 📄 리포트 헤더 & 보안 타이머 */}
      <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-black uppercase tracking-tight ${currentMode.color}`}>
            {currentMode.icon} {currentMode.label}
          </span>
          
          {/* 🛡️ 보안 파기 타이머 명시 */}
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl border border-red-100">
            <ShieldAlert size={16} />
            <span className="text-xs font-bold">
              원본 PDF 파일은 보안을 위해 <strong className="font-black">{formattedDeletionTime}</strong>에 서버에서 완전히 영구 삭제됩니다.
            </span>
          </div>
        </div>
        
        <h1 className="text-2xl font-black text-gray-900 leading-snug mb-2 flex items-start gap-3">
          <FileText className="text-gray-400 mt-1 flex-shrink-0" size={28} />
          {data.title}
        </h1>
      </div>

      {/* 🧠 AI 분석 결과 본문 (순수 텍스트 렌더링) */}
      <div className="bg-white p-10 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-50/50">
        <div 
          className="text-gray-800 text-base leading-relaxed tracking-wide font-medium"
          style={{ whiteSpace: 'pre-wrap' }} // ✅ 핵심: 줄바꿈(\n)을 그대로 화면에 유지
        >
          {data.analysisResult}
        </div>
      </div>

    </main>
  );
}
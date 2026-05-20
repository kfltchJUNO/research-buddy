"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { useParams } from "next/navigation";
import { Loader2, BadgeCheck, TrendingUp, Eye, AlertTriangle } from "lucide-react";

export default function SharedAnalysisPage() {
  const params = useParams();
  const shareId = params.shareId as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!shareId) return;
    (async () => {
      try {
        const docRef = doc(db, "shared_analyses", shareId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) { setExpired(true); setLoading(false); return; }
        const d = snap.data();
        const expiresAt = d.expiresAt?.toDate
          ? d.expiresAt.toDate()
          : new Date(d.expiresAt.seconds * 1000);
        if (expiresAt < new Date()) { setExpired(true); setLoading(false); return; }
        setData(d);
        // 조회수 증가
        await updateDoc(docRef, { viewCount: increment(1) });
      } catch (err) {
        console.error(err);
        setExpired(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [shareId]);

  const renderTextWithSeparators = (text: string) => {
    if (!text) return null;
    return text.split("[구분선: -------------]").map((part, i, arr) => (
      <span key={i}>
        {part}
        {i < arr.length - 1 && <hr className="my-8 border-t-2 border-dashed border-gray-200" />}
      </span>
    ));
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-violet-600" size={40} />
      </div>
    );

  if (expired)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <AlertTriangle size={64} className="text-amber-400 mb-6" />
        <h2 className="text-3xl font-black text-gray-900 mb-3">공유 기간이 만료되었습니다</h2>
        <p className="text-gray-400 font-medium">이 분석 링크는 7일간만 유효합니다.</p>
      </div>
    );

  // 텍스트 파싱
  let mainResultText = data.analysisResult || "";
  let shortSummary = "Research Insight";
  const summaryMatch = mainResultText.match(/\[한줄요약\]\s*(.+)/);
  if (summaryMatch) {
    shortSummary = summaryMatch[1].trim();
    mainResultText = mainResultText.replace(summaryMatch[0], "").trim();
  }
  mainResultText = mainResultText
    .replace(/\[근거 데이터 시작\][\s\S]*?\[근거 데이터 끝\]/, "")
    .trim();

  return (
    <main className="pt-16 pb-24 px-4 sm:px-6 max-w-3xl mx-auto">
      {/* 헤더 배너 */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-900 p-8 rounded-[2.5rem] text-white shadow-2xl mb-8">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="inline-block px-3 py-1 bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest">
            ResearchBuddy 공유 분석 · {data.mode}
          </span>
          {data.reliability?.kciVerified && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/30 border border-green-400/50 rounded-lg text-[10px] font-black text-green-200">
              <BadgeCheck size={11} /> {data.reliability.badgeLabel || "KCI"}
            </span>
          )}
          {data.reliability?.kciCitationCount > 0 && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500/30 border border-amber-400/50 rounded-lg text-[10px] font-black text-amber-200">
              <TrendingUp size={11} /> 피인용 {data.reliability.kciCitationCount}회
            </span>
          )}
        </div>
        <h1 className="text-2xl font-black leading-snug break-keep italic">
          "{shortSummary}"
        </h1>
        <p className="text-sm opacity-50 font-medium mt-3 truncate">{data.title}</p>
      </div>

      {/* 신뢰도 */}
      {data.reliability && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex justify-between text-xs font-bold mb-2">
            <span className="text-gray-400">신뢰도 지표</span>
            <span className="text-violet-600">
              직접 인용 {data.reliability.direct || 65}% · 의미 해석 {data.reliability.semantic || 35}%
            </span>
          </div>
          <div className="flex h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="bg-green-500" style={{ width: `${data.reliability.direct || 65}%` }} />
            <div className="bg-violet-400" style={{ width: `${data.reliability.semantic || 35}%` }} />
          </div>
          {data.reliability.kciVerified && (
            <p className="text-[10px] text-green-600 font-bold mt-2 flex items-center gap-1">
              <BadgeCheck size={10} /> KCI 공식 데이터로 신뢰도 +{data.reliability.kciBoost}점 보정됨
            </p>
          )}
        </div>
      )}

      {/* 본문 */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl">
        <div className="text-gray-800 text-[15px] leading-[1.9] font-medium whitespace-pre-wrap">
          {renderTextWithSeparators(mainResultText)}
        </div>
      </div>

      {/* 푸터 */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-400 font-bold mb-4">
          이 분석은 ResearchBuddy AI로 생성되었습니다
        </p>
        <a
          href="/"
          className="inline-block px-8 py-4 bg-black text-white rounded-2xl font-black text-sm hover:bg-violet-600 transition-colors"
        >
          나도 논문 분석하기 →
        </a>
      </div>
    </main>
  );
}
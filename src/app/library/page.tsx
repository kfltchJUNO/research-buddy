"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  Search, Star, FolderOpen, Zap, Brain, MessageSquare, Loader2,
  BadgeCheck, TrendingUp, StickyNote,
} from "lucide-react";
import Link from "next/link";
import { toggleFavoriteAction } from "@/app/actions/library-actions";
import toast from "react-hot-toast";

export default function LibraryPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [totalInkUsed, setTotalInkUsed] = useState(0); // 보완 #12

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) { router.replace("/login"); return; }
      const q = query(
        collection(db, "knowledge_library"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const unsub = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setDocuments(docs);
        // 보완 #12: 총 INK 소모량 집계
        const total = docs.reduce((acc: number, doc: any) => acc + (doc.inkCost || doc.originalCost || 0), 0);
        setTotalInkUsed(total);
        setLoading(false);
      });
      return () => unsub();
    });
    return () => unsubscribe();
  }, [router]);

  const handleToggleFavorite = async (e: React.MouseEvent, id: string, current: boolean) => {
    e.preventDefault();
    const res = await toggleFavoriteAction(id, current);
    if (!res.success) toast.error("즐겨찾기 업데이트 실패");
  };

  // 보완 #8: 내용 기반 검색 (제목 + 키워드 + 분석 결과 요약 + 태그)
  const filteredDocs = documents.filter((doc) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      doc.title?.toLowerCase().includes(q) ||
      doc.analysisResult?.toLowerCase().includes(q) ||
      doc.tags?.some((t: string) => t.toLowerCase().includes(q));
    const matchesMode = filterMode === "all" || doc.mode?.includes(filterMode);
    const matchesFav = !onlyFavorites || doc.isFavorite;
    return matchesSearch && matchesMode && matchesFav;
  });

  const modeFilters = [
    { id: "all", label: "전체", Icon: FolderOpen },
    { id: "scan", label: "Scan", Icon: Zap },
    { id: "understand", label: "Understand", Icon: Brain },
    { id: "think", label: "Think", Icon: MessageSquare },
  ];

  return (
    <main className="pt-28 pb-32 px-4 sm:px-6 max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="text-4xl font-black italic tracking-tighter text-gray-900">
            Second Brain
          </h1>
          <p className="text-gray-400 font-medium text-sm mt-1">
            {documents.length}개의 연구 기록
          </p>
        </div>
        {/* 보완 #12: 총 INK 사용량 */}
        <div className="bg-white border border-gray-100 rounded-2xl px-6 py-4 text-right shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            총 사용 INK
          </p>
          <p className="text-2xl font-black text-violet-600">🖋️ {totalInkUsed}</p>
        </div>
      </div>

      {/* 검색 & 필터 */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          {/* 보완 #8: placeholder에 내용 검색 가능 명시 */}
          <input
            type="text"
            placeholder="제목, 키워드, 분석 내용으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-violet-400 transition-colors"
          />
        </div>
        <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl">
          {modeFilters.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setFilterMode(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                filterMode === id
                  ? "bg-white text-black shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOnlyFavorites(!onlyFavorites)}
          className={`px-4 py-2 rounded-2xl border flex items-center gap-2 font-black text-sm transition-all ${
            onlyFavorites
              ? "bg-amber-50 border-amber-200 text-amber-600"
              : "bg-white text-gray-400 border-gray-200"
          }`}
        >
          <Star size={16} fill={onlyFavorites ? "currentColor" : "none"} />
          즐겨찾기
        </button>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-violet-600" size={32} />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-[2rem]">
          <p className="text-gray-300 font-black text-lg">
            {searchQuery ? "검색 결과가 없습니다" : "아직 분석한 논문이 없습니다"}
          </p>
          {!searchQuery && (
            <Link
              href="/"
              className="inline-block mt-4 px-6 py-3 bg-black text-white rounded-2xl font-black text-sm hover:bg-violet-600 transition-colors"
            >
              첫 논문 분석하기
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDocs.map((doc) => {
            let createdDateStr = "-";
            try {
              const d = doc.createdAt?.toDate
                ? doc.createdAt.toDate()
                : new Date(doc.createdAt?.seconds * 1000);
              createdDateStr = d.toLocaleDateString("ko-KR");
            } catch {}

            const modeColors: Record<string, string> = {
              scan: "bg-amber-100 text-amber-700",
              understand: "bg-emerald-100 text-emerald-700",
              think: "bg-violet-100 text-violet-700",
            };
            const modeColor =
              modeColors[doc.mode] || "bg-gray-100 text-gray-500";

            return (
              <Link
                href={`/analysis/${doc.id}`}
                key={doc.id}
                className="block bg-white border border-gray-100 rounded-[2rem] p-6 hover:border-violet-200 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${modeColor}`}
                      >
                        {doc.mode}
                      </span>
                      {/* KCI 배지 */}
                      {doc.reliability?.kciVerified && (
                        <span className="flex items-center gap-1 text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                          <BadgeCheck size={10} />
                          {doc.reliability.badgeLabel || "KCI"}
                        </span>
                      )}
                      {doc.reliability?.kciCitationCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                          <TrendingUp size={10} />
                          {doc.reliability.kciCitationCount}회 인용
                        </span>
                      )}
                      {/* 보완 #12: INK 차감 내역 */}
                      {(doc.inkCost || doc.originalCost) && (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                          🖋️ {doc.inkCost || doc.originalCost} INK 사용
                        </span>
                      )}
                      {doc.memos?.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg">
                          <StickyNote size={10} />
                          메모 {doc.memos.length}
                        </span>
                      )}
                    </div>
                    <h3 className="font-black text-gray-900 text-lg leading-tight group-hover:text-violet-600 transition-colors truncate">
                      {doc.title}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2 font-medium">
                      {doc.analysisResult?.slice(0, 100).replace(/\[한줄요약\]/g, "")}...
                    </p>
                    <p className="text-[10px] text-gray-300 font-bold mt-2">
                      {createdDateStr}
                    </p>
                  </div>
                  {/* 즐겨찾기 버튼 (보완 #1) */}
                  <button
                    onClick={(e) => handleToggleFavorite(e, doc.id, doc.isFavorite)}
                    className={`flex-shrink-0 p-2 rounded-xl transition-all ${
                      doc.isFavorite
                        ? "text-amber-400"
                        : "text-gray-200 hover:text-gray-400"
                    }`}
                  >
                    <Star
                      size={20}
                      fill={doc.isFavorite ? "currentColor" : "none"}
                    />
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
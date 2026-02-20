"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from "firebase/firestore";
// 오류 수정: 존재하지 않는 ArrowDownWideEqual 제거
import { Star, Clock, Search } from "lucide-react"; 
import LibraryCard from "./LibraryCard";

type SortOption = "latest" | "favorite";

export default function LibraryList() {
  const [items, setItems] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 초기 쿼리는 항상 최신순으로 가져옴
    const q = query(
      collection(db, "knowledge_library"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setItems(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 즐겨찾기 상태를 DB에 실시간 업데이트하는 로직 추가
  const toggleFavorite = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, "knowledge_library", id), { isFavorite: !current });
    } catch (error) {
      console.error("즐겨찾기 업데이트 실패:", error);
    }
  };

  // [정렬 로직] 클라이언트 사이드 정렬로 즉각적인 UX 제공
  const sortedItems = [...items]
    .filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "favorite") {
        if (a.isFavorite === b.isFavorite) {
          return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        }
        return a.isFavorite ? -1 : 1;
      }
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });

  return (
    <div className="max-w-5xl mx-auto py-10 px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <h2 className="text-4xl font-black text-gray-900 tracking-tight">나의 연구 노트 🖋️</h2>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* 검색바 */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="제목 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl w-full focus:border-violet-600 outline-none transition-all shadow-sm"
            />
          </div>

          {/* 정렬 버튼 */}
          <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200 shadow-inner">
            <button 
              onClick={() => setSortBy("latest")}
              className={`p-2 rounded-xl transition-all ${sortBy === "latest" ? "bg-white shadow-sm text-violet-600" : "text-gray-400 hover:text-gray-600"}`}
              title="최신순"
            >
              <Clock size={20} />
            </button>
            <button 
              onClick={() => setSortBy("favorite")}
              className={`p-2 rounded-xl transition-all ${sortBy === "favorite" ? "bg-white shadow-sm text-yellow-500" : "text-gray-400 hover:text-gray-600"}`}
              title="즐겨찾기순"
            >
              <Star size={20} fill={sortBy === "favorite" ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-100 animate-pulse rounded-[2.5rem]" />)}
        </div>
      ) : sortedItems.length > 0 ? (
        <div className="grid gap-6">
          {sortedItems.map((item) => (
            <LibraryCard 
              key={item.id} 
              item={item} 
              onFavoriteToggle={() => toggleFavorite(item.id, item.isFavorite)} 
            />
          ))}
        </div>
      ) : (
        <div className="py-32 text-center border-2 border-dashed border-gray-100 rounded-[3rem] text-gray-400 font-medium">
          아직 분석된 연구 노트가 없습니다. 첫 논문을 업로드해보세요!
        </div>
      )}
    </div>
  );
}
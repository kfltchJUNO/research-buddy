"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { Star, Clock, ArrowDownWideEqual, Search } from "lucide-react";
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

  // [정렬 로직] 클라이언트 사이드 정렬로 즉각적인 UX 제공
  const sortedItems = [...items]
    .filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "favorite") {
        // 즐겨찾기(true)가 앞으로 오고, 그 안에서 최신순 정렬
        if (a.isFavorite === b.isFavorite) {
          return b.createdAt?.seconds - a.createdAt?.seconds;
        }
        return a.isFavorite ? -1 : 1;
      }
      // 기본: 최신순
      return b.createdAt?.seconds - a.createdAt?.seconds;
    });

  return (
    <div className="max-w-5xl mx-auto py-10 px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <h2 className="text-3xl font-black">나의 연구 노트 🖋️</h2>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* 검색바 */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="제목 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl w-full outline-none focus:border-black transition-all"
            />
          </div>

          {/* 정렬 버튼 */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setSortBy("latest")}
              className={`p-2 rounded-lg transition-all ${sortBy === "latest" ? "bg-white shadow-sm text-black" : "text-gray-400"}`}
              title="최신순"
            >
              <Clock size={20} />
            </button>
            <button 
              onClick={() => setSortBy("favorite")}
              className={`p-2 rounded-lg transition-all ${sortBy === "favorite" ? "bg-white shadow-sm text-yellow-500" : "text-gray-400"}`}
              title="즐겨찾기순"
            >
              <Star size={20} fill={sortBy === "favorite" ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-3xl" />)}
        </div>
      ) : sortedItems.length > 0 ? (
        <div className="grid gap-4">
          {sortedItems.map((item) => (
            <LibraryCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center border-2 border-dashed rounded-3xl text-gray-400">
          아직 분석된 연구 노트가 없습니다.
        </div>
      )}
    </div>
  );
}
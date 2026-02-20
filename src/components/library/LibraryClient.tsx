"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from "firebase/firestore";
import { Search, Star, Filter, FolderOpen, Zap, Brain, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import LibraryCard from "./LibraryCard";

export default function LibraryClient() {
  const [items, setItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<string>("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 내 분석 기록 실시간 리스너
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

  // 필터링 로직
  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.keywords?.some((k: string) => k.includes(searchTerm));
    const matchesMode = filterMode === "all" || item.mode === filterMode;
    const matchesFavorite = !onlyFavorites || item.isFavorite;
    
    return matchesSearch && matchesMode && matchesFavorite;
  });

  const toggleFavorite = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "knowledge_library", id), { isFavorite: !current });
  };

  return (
    <div className="space-y-8">
      {/* 검색 및 필터 바 */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="논문 제목이나 키워드로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:border-black transition-all outline-none"
          />
        </div>
        
        <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl">
          {[
            { id: 'all', label: '전체', icon: FolderOpen },
            { id: 'scan', label: 'Scan', icon: Zap },
            { id: 'understand', label: 'Understand', icon: Brain },
            { id: 'think', label: 'Think', icon: MessageSquare },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setFilterMode(mode.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                filterMode === mode.id ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <mode.icon size={16} />
              {mode.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setOnlyFavorites(!onlyFavorites)}
          className={`px-5 py-3 rounded-2xl border flex items-center gap-2 font-bold transition-all ${
            onlyFavorites ? 'bg-yellow-50 border-yellow-200 text-yellow-600' : 'bg-white text-gray-400'
          }`}
        >
          <Star size={20} fill={onlyFavorites ? "currentColor" : "none"} />
          즐겨찾기
        </button>
      </div>

      {/* 목록 렌더링 */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-3xl" />)}
        </div>
      ) : (
        <motion.div layout className="grid gap-4">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => (
              <LibraryCard 
                key={item.id} 
                item={item} 
                onFavoriteToggle={() => toggleFavorite(item.id, item.isFavorite)} 
              />
            ))}
          </AnimatePresence>
          {filteredItems.length === 0 && (
            <div className="py-20 text-center text-gray-400 border-2 border-dashed rounded-3xl">
              검색 결과와 일치하는 연구 노트가 없습니다.
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
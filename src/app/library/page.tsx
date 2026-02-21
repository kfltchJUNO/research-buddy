"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import Header from "@/components/layout/Header";
import LibraryCard from "@/components/library/LibraryCard";
import { Library, Search, Filter, Loader2 } from "lucide-react";

export default function LibraryPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;

  useEffect(() => {
    const fetchLibrary = async () => {
      if (!user) return;
      try {
        // 지식 라이브러리에서 해당 유저의 문서를 최신순으로 가져옵니다.
        const q = query(
          collection(db, "knowledge_library"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const libraryData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setDocs(libraryData);
      } catch (error) {
        console.error("Library Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLibrary();
  }, [user]);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <Header />
      
      <main className="max-w-7xl mx-auto pt-32 pb-20 px-6">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h2 className="text-4xl font-black text-gray-900 mb-2 tracking-tighter flex items-center gap-3">
              <Library className="text-violet-600" size={36} /> 지식 라이브러리
            </h2>
            <p className="text-gray-400 font-bold italic">“내 연구의 궤적을 기록합니다.”</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-violet-600 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="논문 제목 검색..." 
                className="pl-12 pr-6 py-3.5 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-violet-50 transition-all w-64 shadow-sm"
              />
            </div>
            <button className="p-3.5 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-violet-600 transition-all shadow-sm">
              <Filter size={20} />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="animate-spin text-violet-600" size={40} />
            <p className="text-gray-400 font-black animate-pulse text-sm uppercase tracking-widest">Loading Library...</p>
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-40 bg-white rounded-[3.5rem] border-2 border-dashed border-gray-100 shadow-inner">
            <div className="text-6xl mb-6">🏜️</div>
            <h3 className="text-xl font-black text-gray-900 mb-2">서재가 비어있습니다.</h3>
            <p className="text-gray-400 font-medium">첫 번째 논문을 분석하고 연구를 시작해보세요!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {docs.map(doc => (
              // ✅ 수정: Props 명칭을 item으로 전달하여 LibraryCard와 일치시킴
              <LibraryCard key={doc.id} item={doc} /> 
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";

export default function RecentLibrarySummary({ userId }: { userId: string }) {
  const [recentItems, setRecentItems] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "knowledge_library"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(3)
    );

    return onSnapshot(q, (snapshot) => {
      setRecentItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [userId]);

  if (recentItems.length === 0) return null;

  return (
    <div className="mt-12 w-full max-w-4xl">
      <div className="flex justify-between items-end mb-6">
        <h3 className="text-lg font-bold">최근 연구 노트</h3>
        <Link href="/library" className="text-sm text-gray-400 hover:text-black font-bold flex items-center gap-1">
          전체 보기 <ChevronRight size={16} />
        </Link>
      </div>
      <div className="grid gap-4">
        {recentItems.map((item) => (
          <Link 
            key={item.id} 
            href={`/analysis/${item.id}`}
            className="p-5 bg-white border rounded-2xl flex items-center justify-between hover:border-black transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-blue-50 transition-colors">
                <FileText size={20} className="text-gray-400 group-hover:text-blue-500" />
              </div>
              <div>
                <div className="font-bold text-gray-900">{item.title}</div>
                <div className="text-xs text-gray-400">{item.oneLineSummary}</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
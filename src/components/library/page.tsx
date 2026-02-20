"use client";

import LibraryList from "@/components/library/LibraryList";
import Header from "@/components/layout/Header";

export default function KnowledgeLibrary() {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* 레이아웃의 통일성을 위해 Header를 포함합니다. */}
      <Header />
      
      <main className="pb-20">
        {/* 실제 Firestore 데이터와 정렬/필터 로직이 포함된 LibraryList를 호출합니다. */}
        <LibraryList />
      </main>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import Header from "@/components/layout/Header";
import UploadZone from "@/components/library/UploadZone";
import RecentLibrarySummary from "@/components/dashboard/RecentLibrarySummary";
import WelcomeGuide from "@/components/guide/WelcomeGuide";
import GoogleLoginButton from "@/components/auth/GoogleLoginButton";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 실제 Firebase 인증 상태를 감시합니다.
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <Header />
      <WelcomeGuide />

      <main className="pt-32 pb-20 px-6 flex flex-col items-center">
        {/* 비로그인 상태일 때 보여줄 화면 */}
        {!user ? (
          <section className="text-center max-w-lg">
            <h2 className="text-4xl font-black text-gray-900 mb-6">
              연구의 깊이를 조절하는<br/>나만의 AI 조수
            </h2>
            <p className="text-gray-500 mb-10 font-medium">
              로그인 후 논문을 업로드하여 3초 스캔부터<br/>비판적 사고까지 경험해보세요.
            </p>
            <GoogleLoginButton />
          </section>
        ) : (
          /* 로그인 상태일 때만 업로드 존과 라이브러리를 보여줍니다. */
          <>
            <section className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-4">
                이 논문, 어디까지 이해하고 싶으세요?
              </h2>
              <p className="text-gray-400 font-medium italic">
                “우리는 답이 아니라, 생각을 만듭니다.”
              </p>
            </section>

            <div className="w-full max-w-2xl">
              <UploadZone />
            </div>

            <RecentLibrarySummary userId={user.uid} />
          </>
        )}

        {/* 안내 가이드 카드는 항상 보여줍니다. */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl opacity-80">
          <div className="p-8 bg-white border border-gray-100 rounded-[2.5rem]">
            <div className="text-3xl mb-4">⚡</div>
            <h4 className="font-bold mb-2">초고속 Scan</h4>
            <p className="text-sm text-gray-500">3초 만에 핵심 키워드 파악</p>
          </div>
          <div className="p-8 bg-white border border-gray-100 rounded-[2.5rem]">
            <div className="text-3xl mb-4">🔍</div>
            <h4 className="font-bold mb-2">심층 Understand</h4>
            <p className="text-sm text-gray-500">구조화된 요약과 핵심 설명</p>
          </div>
          <div className="p-8 bg-white border border-gray-100 rounded-[2.5rem]">
            <div className="text-3xl mb-4">🧠</div>
            <h4 className="font-bold mb-2">비판적 Think</h4>
            <p className="text-sm text-gray-500">AI와 논쟁하며 나만의 질문 도출</p>
          </div>
        </div>
      </main>
    </div>
  );
}
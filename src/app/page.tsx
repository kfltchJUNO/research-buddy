import Header from "@/components/layout/Header";
import UploadZone from "@/components/analysis/UploadZone"; // 이전에 만든 업로드 존
import RecentLibrarySummary from "@/components/dashboard/RecentLibrarySummary";
import WelcomeGuide from "@/components/guide/WelcomeGuide";
import { auth } from "@/lib/firebase"; // 실제 구현 시 훅이나 세션 관리 필요

export default function DashboardPage() {
  // 실제 유저 데이터는 세션이나 전역 상태에서 가져옵니다.
  const mockUser = { uid: "user_123", nickname: "연구자A12" };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <Header user={mockUser} />
      <WelcomeGuide />

      <main className="pt-32 pb-20 px-6 flex flex-col items-center">
        {/* 서비스 핵심 슬로건 */}
        <section className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-4">
            이 논문, 어디까지 이해하고 싶으세요?
          </h2>
          <p className="text-gray-400 font-medium italic">
            “우리는 답이 아니라, 생각을 만듭니다.”
          </p>
        </section>

        {/* 메인 업로드 존: 3초 스캔의 시작점 */}
        <div className="w-full max-w-2xl">
          <UploadZone />
        </div>

        {/* 분석 결과가 없을 때 보여주는 안내 가이드 */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          <div className="p-8 bg-white border rounded-[2.5rem] shadow-sm">
            <div className="text-3xl mb-4">⚡</div>
            <h4 className="font-bold mb-2">초고속 Scan</h4>
            <p className="text-sm text-gray-500 leading-relaxed">3초 만에 핵심 키워드와 맥락을 파악하여 읽을 가치가 있는지 판단하세요.</p>
          </div>
          <div className="p-8 bg-white border rounded-[2.5rem] shadow-sm">
            <div className="text-3xl mb-4">🔍</div>
            <h4 className="font-bold mb-2">심층 Understand</h4>
            <p className="text-sm text-gray-500 leading-relaxed">구조화된 요약과 핵심 개념 설명을 통해 논문 전체를 완벽히 이해하세요.</p>
          </div>
          <div className="p-8 bg-white border rounded-[2.5rem] shadow-sm">
            <div className="text-3xl mb-4">🧠</div>
            <h4 className="font-bold mb-2">비판적 Think</h4>
            <p className="text-sm text-gray-500 leading-relaxed">AI와 논쟁하며 저자의 한계를 찾고 나만의 연구 질문을 도출하세요.</p>
          </div>
        </div>

        {/* 라이브러리 요약 */}
        <RecentLibrarySummary userId={mockUser.uid} />
      </main>
    </div>
  );
}
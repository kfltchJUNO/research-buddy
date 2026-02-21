// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header"; // ✅ 헤더 컴포넌트 불러오기
import { Toaster } from "react-hot-toast"; // 알림창

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ResearchBuddy | Research Faster. Think Deeper.",
  description: "AI 기반 논문 분석 파트너",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-[#F9FAFB] text-gray-900 antialiased min-h-screen`}>
        {/* ✅ 화면 최상단에 헤더 고정 */}
        <Header />
        
        {/* 헤더 높이만큼 여백을 주고 메인 콘텐츠 표시 */}
        <main className="pt-20">
          {children}
        </main>

        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
"use client";

import { useState } from "react";
import { useInk } from "@/hooks/useInk";
import RollingNumber from "@/components/common/RollingNumber";
import { Menu, X, LogOut, User, Zap, BookOpen, Settings } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function Header({ user }: { user: any }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const inkBalance = useInk();

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <header className="fixed top-0 left-0 right-0 h-16 md:h-20 bg-white/90 backdrop-blur-lg border-b z-[100] px-4 md:px-8 flex justify-between items-center">
      {/* 로고 섹션 */}
      <Link href="/" className="flex items-center gap-2 group">
        <span className="text-xl md:text-2xl group-hover:rotate-12 transition-transform">🖋️</span>
        <h1 className="text-lg md:text-xl font-black tracking-tighter">ResearchBuddy</h1>
      </Link>

      {/* PC 메뉴: 잉크 및 프로필 */}
      <div className="hidden md:flex items-center gap-6">
        <nav className="flex items-center gap-6 mr-6 border-r pr-6 border-gray-100">
          <Link href="/library" className="text-sm font-bold text-gray-500 hover:text-black transition-colors">라이브러리</Link>
          <Link href="/pricing" className="text-sm font-bold text-gray-500 hover:text-black transition-colors">잉크 충전</Link>
        </nav>

        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 px-4 py-2 rounded-2xl">
          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Ink</span>
          <div className="flex items-center gap-1 text-blue-600 font-black text-base">
            <RollingNumber value={inkBalance} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-bold text-gray-900">{user?.nickname}</div>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 버튼 */}
      <div className="flex md:hidden items-center gap-3">
        <div className="flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-full text-blue-600 font-black text-sm">
          <RollingNumber value={inkBalance} />
        </div>
        <button onClick={toggleMenu} className="p-2 text-gray-900">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* 모바일 드롭다운 메뉴 */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-0 right-0 bg-white border-b shadow-xl p-6 flex flex-col gap-4 md:hidden"
          >
            <Link href="/library" onClick={toggleMenu} className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl font-bold">
              <BookOpen size={20} /> 지식 라이브러리
            </Link>
            <Link href="/pricing" onClick={toggleMenu} className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl font-bold">
              <Zap size={20} className="text-blue-500" /> 잉크 충전하기
            </Link>
            <button 
              onClick={() => { signOut(auth); toggleMenu(); }}
              className="flex items-center gap-3 p-4 text-red-500 font-bold"
            >
              <LogOut size={20} /> 로그아웃
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
"use client";

import React from "react";
import Link from "next/link";
import { useInk } from "@/hooks/useInk";
import RollingNumber from "@/components/common/RollingNumber";
import { auth } from "@/lib/firebase";
import { LogOut, Library, Zap } from "lucide-react";
import { signOut } from "firebase/auth";

// user를 props로 받거나, 내부에서 auth.currentUser를 참조할 수 있습니다.
export default function Header({ user }: { user?: any }) {
  const { inkBalance } = useInk(); // 커스텀 훅에서 잔액 가져오기

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/";
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md border-b z-50 px-8 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🖋️</span>
        <h1 className="text-xl font-black tracking-tighter text-gray-900">ResearchBuddy</h1>
      </div>

      <div className="flex items-center gap-6">
        {/* 실시간 잉크 상태바 */}
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 px-5 py-2 rounded-2xl">
          <span className="text-xs font-black text-blue-400 uppercase tracking-widest">My Ink</span>
          <div className="flex items-center gap-1.5 text-blue-600 font-black text-lg">
            <span>🖋️</span>
            <RollingNumber value={inkBalance} />
          </div>
        </div>

        {/* 사용자 프로필 영역 */}
        <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-gray-900">{user?.nickname || "연구자"}</div>
            <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">
              ID: {user?.uid?.slice(0, 5) || "Guest"}
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
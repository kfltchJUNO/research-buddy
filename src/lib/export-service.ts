"use client";

import { useInk } from "@/hooks/useInk";
import RollingNumber from "@/components/common/RollingNumber";
import { User, LogOut, ChevronDown } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export default function Header({ user }: { user: any }) {
  return (
    <header className="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md border-b z-50 px-8 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🖋️</span>
        <h1 className="text-xl font-black tracking-tighter">ResearchBuddy</h1>
      </div>

      <div className="flex items-center gap-6">
        {/* 실시간 잉크 상태바 */}
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 px-5 py-2 rounded-2xl">
          <span className="text-xs font-black text-blue-400 uppercase tracking-widest">My Ink</span>
          <div className="flex items-center gap-1.5 text-blue-600 font-black text-lg">
            <span>🖋️</span>
            <RollingNumber value={useInk()} />
          </div>
        </div>

        {/* 사용자 프로필 드롭다운 */}
        <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-gray-900">{user?.nickname}</div>
            <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">Researcher ID: {user?.uid.slice(0, 5)}</div>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { LogOut, User as UserIcon, ShieldCheck, BookOpen, PlusCircle, Sparkles, Circle } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  // 파이어베이스 인증 및 유저 데이터 실시간 감시
  useEffect(() => {
    setIsMounted(true);
    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        return onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) setUserData(docSnap.data());
        });
      } else {
        setUserData(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    toast.success("안전하게 로그아웃되었습니다.");
    router.push("/login");
  };

  if (!isMounted) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100 h-20 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        
        {/* 📚 왼쪽 섹션: 로고 & 연구 기록 링크 */}
        <div className="flex items-center gap-10">
          <Link href="/" className="text-2xl font-black text-gray-900 italic tracking-tighter hover:text-violet-600 transition-colors">
            ResearchBuddy <span className="text-violet-600 text-[10px] not-italic font-black ml-1 border border-violet-200 px-1.5 py-0.5 rounded">BETA</span>
          </Link>
          {user && (
            <Link href="/library" className="flex items-center gap-2 text-gray-500 hover:text-violet-600 transition-colors font-black text-sm italic tracking-tight">
              <BookOpen size={18} />
              연구 기록
            </Link>
          )}
        </div>

        {/* 👤 오른쪽 섹션: 유저 상태 및 계정 정보 */}
        <nav className="flex items-center gap-5">
          {user ? (
            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right-2 duration-500">
              
              {/* 1. 🛡️ 관리자(Admin) 전용 대시보드 버튼 */}
              {userData?.role === "admin" && (
                <Link 
                  href="/admin" 
                  className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-2xl hover:bg-violet-600 transition-all shadow-lg shadow-gray-200 group"
                >
                  <ShieldCheck size={16} className="group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-black uppercase tracking-widest">Admin</span>
                </Link>
              )}

              {/* 2. 🎁 무료 분석권 (hasFreeTrial이 true일 때만 반짝임) */}
              {userData?.hasFreeTrial && (
                <div className="flex items-center gap-1.5 bg-violet-600 text-white px-3 py-1.5 rounded-xl shadow-lg shadow-violet-100 animate-pulse">
                  <Sparkles size={12} />
                  <span className="text-[10px] font-black uppercase tracking-tighter">Free</span>
                </div>
              )}

              {/* 3. 🖋️ 잉크 잔액 */}
              <Link href="/library/ink" className="flex items-center gap-2 bg-gray-50 px-4 py-2.5 rounded-2xl border border-gray-100 hover:border-violet-200 transition-all group">
                <span className="text-base group-hover:scale-110 transition-transform">🖋️</span>
                <span className="font-black text-gray-900 text-sm">{userData?.inkBalance || 0}</span>
                <PlusCircle size={14} className="text-gray-300" />
              </Link>

              {/* 4. ✅ 계정 정보 섹션 (온라인 상태 및 닉네임) */}
              <div className="flex items-center gap-3 pl-5 border-l border-gray-100">
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black text-green-500 uppercase">Online</span>
                    <Circle size={6} fill="currentColor" className="text-green-500 animate-ping" />
                  </div>
                  <span className="text-xs font-black text-gray-900 tracking-tight">
                    {userData?.nickname || "연구자"}님
                  </span>
                </div>

                <div className="w-10 h-10 bg-gray-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-gray-200">
                  <UserIcon size={20} />
                </div>
              </div>

              {/* 5. 🚪 로그아웃 */}
              <button 
                onClick={handleLogout} 
                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                title="로그아웃"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            /* 🔴 비로그인 상태 표시 (Guest Mode) */
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">Guest Mode</span>
              <Link href="/login" className="px-8 py-3 bg-black text-white rounded-[1.2rem] font-black text-xs uppercase tracking-widest hover:bg-violet-600 transition-all shadow-xl shadow-gray-200">
                Researcher Login
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
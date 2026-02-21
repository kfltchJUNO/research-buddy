"use client";

import { auth, db, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Search, Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // 🔍 1. 신규 유저인지 확인
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // 🎁 2. 신규 유저라면 '무료 분석권' 포함 초기 데이터 생성
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          nickname: user.displayName || "연구자",
          role: "user",
          inkBalance: 0,
          hasFreeTrial: true, // ✅ 무료권 지급
          analysisCount: 0,
          createdAt: serverTimestamp(),
        });
        toast.success("반갑습니다! 신규 연구자님께 무료 분석권 1회를 드립니다. 🎁");
      } else {
        toast.success(`${userSnap.data().nickname}님, 다시 연구를 시작해볼까요?`);
      }
      router.push("/");
    } catch (err) {
      toast.error("로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6">
      <div className="text-center mb-10">
        <Sparkles className="text-violet-600 mx-auto mb-4" size={48} />
        <h1 className="text-4xl font-black italic tracking-tighter">ResearchBuddy</h1>
      </div>
      <button 
        onClick={handleLogin} 
        disabled={loading}
        className="bg-black text-white px-10 py-5 rounded-[1.5rem] font-black flex items-center gap-3 hover:bg-violet-600 transition-all shadow-xl disabled:bg-gray-200"
      >
        {loading ? <Loader2 className="animate-spin" /> : <Search size={20} />}
        CONTINUE WITH GOOGLE
      </button>
    </div>
  );
}
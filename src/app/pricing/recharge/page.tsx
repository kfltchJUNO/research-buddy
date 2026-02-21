"use client";

import { useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import Header from "@/components/layout/Header";
import toast from "react-hot-toast";

const PLANS = [
  { id: 'p1', ink: 100, price: 6900, label: "실속형" },
  { id: 'p2', ink: 250, price: 14900, label: "실용형 (인기)" },
  { id: 'p3', ink: 600, price: 29000, label: "전문가형 (추천)" },
];

export default function RechargePage() {
  const [loading, setLoading] = useState(false);

  const requestRecharge = async (plan: any) => {
    const user = auth.currentUser;
    if (!user) return toast.error("로그인이 필요합니다.");

    setLoading(true);
    try {
      await addDoc(collection(db, "ink_requests"), {
        userId: user.uid,
        userEmail: user.email,
        inkAmount: plan.ink,
        price: plan.price,
        status: "pending",
        requestedAt: serverTimestamp(),
      });
      toast.success("충전 요청 완료! 입금 확인 후 지급됩니다.");
    } catch (e) {
      toast.error("요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <Header />
      <main className="max-w-5xl mx-auto pt-32 pb-20 px-6">
        <h2 className="text-4xl font-black text-center mb-12 tracking-tighter">Ink 충전소 🖋️</h2>
        
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {PLANS.map(plan => (
            <div key={plan.id} className="bg-white p-10 rounded-[3rem] border-2 border-gray-100 hover:border-violet-600 transition-all text-center group shadow-sm">
              <span className="text-[10px] font-black text-violet-400 uppercase tracking-[0.2em]">{plan.label}</span>
              <div className="text-5xl font-black my-8 group-hover:scale-110 transition-transform">{plan.ink} <span className="text-lg text-gray-300">Ink</span></div>
              <div className="text-gray-900 font-black text-2xl mb-10">₩{plan.price.toLocaleString()}</div>
              <button 
                onClick={() => requestRecharge(plan)}
                disabled={loading}
                className="w-full py-5 bg-gray-900 text-white rounded-[1.5rem] font-black hover:bg-violet-600 transition-colors disabled:bg-gray-300 shadow-xl shadow-gray-200"
              >
                {loading ? "요청 중..." : "충전 요청하기"}
              </button>
            </div>
          ))}
        </div>

        <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-sm max-w-2xl mx-auto">
          <h4 className="font-black text-gray-900 text-2xl mb-8 flex items-center gap-3">
            <span className="w-10 h-10 bg-yellow-400 rounded-2xl flex items-center justify-center text-lg">🏦</span>
            입금 계좌 정보
          </h4>
          <div className="space-y-5 text-gray-700">
            <div className="flex justify-between items-center py-4 border-b border-gray-50">
              <span className="font-bold text-gray-400 text-sm">은행</span>
              <span className="font-black text-lg">카카오뱅크</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-gray-50">
              <span className="font-bold text-gray-400 text-sm">계좌번호</span>
              <span className="font-black text-2xl text-violet-600 tracking-tight">3333-29-9690780</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-gray-50">
              <span className="font-bold text-gray-400 text-sm">예금주</span>
              <span className="font-black text-lg text-gray-900">오준호</span>
            </div>
            <p className="pt-8 text-[13px] text-gray-400 font-medium leading-relaxed text-center">
              * 입금자명과 로그인하신 계정 정보가 동일해야 처리가 빠릅니다.<br/>
              * 관리자 승인 후 실시간으로 잉크가 반영됩니다.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
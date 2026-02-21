"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import Header from "@/components/layout/Header";
import { useInk } from "@/hooks/useInk";
import { History, CreditCard, ChevronLeft, Zap } from "lucide-react";
import Link from "next/link";

export default function InkManagementPage() {
  const { inkBalance } = useInk();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);
  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <Header />
      <main className="max-w-2xl mx-auto pt-40 pb-20 px-6">
        <Link href="/library" className="flex items-center gap-2 text-gray-400 hover:text-black font-black mb-10 transition-colors group text-sm uppercase tracking-widest">
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Back to Library
        </Link>

        <div className="bg-white rounded-[3.5rem] shadow-2xl overflow-hidden border border-gray-100">
          <div className="p-16 bg-gray-900 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 font-black text-[12rem] select-none italic">INK</div>
            <div className="text-[10px] font-black opacity-40 uppercase tracking-[0.5em] mb-6">Current Available Ink</div>
            <div className="text-8xl font-black mb-14 tracking-tighter italic flex items-center justify-center gap-4">
              <span className="text-violet-500 animate-pulse">🖋️</span> {inkBalance}
            </div>
            <Link href="/pricing/recharge" className="inline-flex items-center gap-3 bg-violet-600 text-white px-12 py-5 rounded-[2rem] font-black hover:bg-violet-500 transition-all shadow-xl hover:-translate-y-1">
              <CreditCard size={22} /> 충전 요청하기 (100 Ink ~)
            </Link>
          </div>

          <div className="p-12 text-center">
            <div className="flex items-center justify-center gap-3 mb-8">
              <History size={20} className="text-gray-300" />
              <h4 className="font-black text-gray-400 text-sm uppercase tracking-widest">Recent Activity</h4>
            </div>
            <div className="py-20 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
              <p className="text-gray-300 font-black text-sm italic">“연구의 흔적은 지식 라이브러리에 기록됩니다.”</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
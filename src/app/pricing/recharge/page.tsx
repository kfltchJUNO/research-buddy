"use client";

import { useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Info } from "lucide-react";
import toast from "react-hot-toast";

export default function RechargePage() {
  const router = useRouter();
  const [depositor, setDepositor] = useState("");
  const [amount, setAmount] = useState(50); // 기본 50 Ink
  const [isSubmitting, setIsSubmitting] = useState(false);

  const price = amount * 100; // 1 Ink = 100원 기준

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    if (!depositor) {
      toast.error("입금자명을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "ink_requests"), {
        userId: user.uid,
        depositorName: depositor,
        amount: amount,
        price: price,
        status: "pending",
        requestedAt: serverTimestamp(),
      });

      toast.success("충전 요청이 완료되었습니다. 확인 후 즉시 지급됩니다!", {
        duration: 5000,
        icon: '🖋️'
      });
      router.push("/");
    } catch (err) {
      toast.error("요청 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="pt-32 pb-20 px-6 max-w-xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black mb-2">잉크 충전 요청</h2>
        <p className="text-gray-500">입금 확인 후 10분 내로 잉크가 지급됩니다.</p>
      </div>

      {/* 무통장 입금 안내 카드 */}
      <div className="bg-black text-white p-8 rounded-[2.5rem] mb-8 shadow-xl">
        <div className="flex items-center gap-2 mb-6 opacity-60 text-sm font-bold">
          <CreditCard size={16} /> 입금 계좌 안내
        </div>
        <div className="space-y-2">
          <p className="text-2xl font-black text-blue-400">카카오뱅크 3333-01-1234567</p>
          <p className="text-lg font-bold">예금주: 리서치버디 (준호)</p>
        </div>
        <div className="mt-6 p-4 bg-white/10 rounded-2xl flex gap-3">
          <Info size={20} className="shrink-0 text-blue-300" />
          <p className="text-xs leading-relaxed opacity-80">
            반드시 입력하신 입금자명과 동일한 이름으로 송금해주세요. 확인이 지연될 수 있습니다.
          </p>
        </div>
      </div>

      {/* 정보 입력 폼 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-black ml-1 text-gray-700">입금자명</label>
          <input 
            type="text"
            placeholder="송금하신 분의 실명을 입력하세요"
            value={depositor}
            onChange={(e) => setDepositor(e.target.value)}
            className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-black transition-all outline-none font-bold"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-black ml-1 text-gray-700">충전 수량 선택</label>
          <div className="grid grid-cols-3 gap-3">
            {[50, 100, 300].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(val)}
                className={`py-4 rounded-2xl font-black transition-all border-2 ${
                  amount === val ? 'border-black bg-black text-white' : 'border-gray-100 bg-white text-gray-400'
                }`}
              >
                {val} Ink
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-[2rem] flex justify-between items-center">
          <span className="font-bold text-gray-500">최종 입금 금액</span>
          <span className="text-2xl font-black">{price.toLocaleString()}원</span>
        </div>

        <button
          disabled={isSubmitting}
          className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-lg hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:bg-gray-300"
        >
          {isSubmitting ? "처리 중..." : "입금 확인 요청하기"}
        </button>
      </form>
    </main>
  );
}
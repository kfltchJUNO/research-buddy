"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, collection, query, where, orderBy, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, CreditCard, History, CheckCircle2, AlertCircle, Sparkles, Send } from "lucide-react";
import toast from "react-hot-toast";

// 💰 합의된 잉크 요금표 데이터
const PRICING_PLANS = [
  { id: 'basic', ink: 100, price: '6,900', desc: '가벼운 리서치를 위한 시작' },
  { id: 'pro', ink: 250, price: '14,900', desc: '본격적인 논문 분석에 최적', popular: true },
  { id: 'expert', ink: 600, price: '29,000', desc: '대량의 논문을 다루는 연구자용', best: true }
];

export default function InkStationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'charge' | 'history'>('charge');
  const [historyData, setHistoryData] = useState<any[]>([]);
  
  // 결제 관련 상태
  const [selectedPlan, setSelectedPlan] = useState<typeof PRICING_PLANS[0] | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      // 1. 유저 잉크 정보 실시간 구독
      const userRef = doc(db, "users", user.uid);
      const unsubUser = onSnapshot(userRef, (snap) => {
        if (snap.exists()) setUserData(snap.data());
        setLoading(false);
      });

      // 2. 사용 내역 (knowledge_library) 불러오기
      try {
        const q = query(collection(db, "knowledge_library"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const history = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHistoryData(history);
      } catch (error) {
        console.error("사용 내역 로드 실패:", error);
      }

      return () => unsubUser();
    });
    return () => unsubscribe();
  }, [router]);

  // 🚀 충전 요청 (파이어베이스 DB에 기록)
  const handleChargeRequest = async () => {
    if (!selectedPlan || !auth.currentUser) return;
    setIsRequesting(true);

    try {
      await addDoc(collection(db, "charge_requests"), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        nickname: userData?.nickname || "연구자",
        requestedInk: selectedPlan.ink,
        amount: selectedPlan.price,
        status: "pending", // 대기 상태
        createdAt: serverTimestamp(),
      });

      toast.success(`${selectedPlan.ink} INK 충전 요청이 접수되었습니다! 입금 확인 후 지급됩니다.`);
      setSelectedPlan(null); // 모달 닫기
    } catch (error) {
      toast.error("요청 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsRequesting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen pt-32 flex justify-center"><Loader2 className="animate-spin text-violet-600" size={40} /></div>;
  }

  return (
    <main className="pt-28 pb-32 px-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      
      {/* 🔙 상단 네비게이션 */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-gray-500 hover:text-black font-bold text-sm">
          <ArrowLeft size={16} /> 메인으로 돌아가기
        </button>
      </div>

      {/* 💳 현재 잉크 상태 카드 */}
      <div className="bg-gray-900 text-white p-8 rounded-[2rem] shadow-xl mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-gray-400 font-bold text-sm mb-2 uppercase tracking-widest">현재 보유 잉크</h2>
          <div className="text-5xl font-black flex items-center gap-3">
            🖋️ {userData?.inkBalance || 0}
          </div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700 max-w-xs w-full text-center md:text-left">
          <p className="text-sm font-bold text-gray-300 mb-1">
            {userData?.hasFreeTrial ? "✨ 첫 분석 무료 혜택이 남아있습니다!" : "잉크가 부족하신가요?"}
          </p>
          <p className="text-xs text-gray-500">아래에서 요금제를 선택하고 연구를 이어가세요.</p>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-4 mb-8 border-b border-gray-100 pb-px">
        <button 
          onClick={() => setActiveTab('charge')}
          className={`pb-4 px-2 font-black text-lg transition-colors border-b-2 ${activeTab === 'charge' ? 'border-violet-600 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          잉크 충전소
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`pb-4 px-2 font-black text-lg transition-colors border-b-2 ${activeTab === 'history' ? 'border-violet-600 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
          사용 내역
        </button>
      </div>

      {/* 💰 [탭 1] 충전소 화면 */}
      {activeTab === 'charge' && (
        <div className="animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {PRICING_PLANS.map((plan) => (
              <div 
                key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                className={`relative bg-white p-8 rounded-[2rem] border-2 cursor-pointer transition-all duration-300 hover:-translate-y-1 shadow-lg ${
                  plan.popular ? 'border-violet-500 shadow-violet-100' : (plan.best ? 'border-gray-900 shadow-gray-200' : 'border-gray-100 hover:border-violet-300')
                }`}
              >
                {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Most Popular</span>}
                {plan.best && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1"><Sparkles size={10}/> Best Value</span>}
                
                <h3 className="text-3xl font-black text-gray-900 mb-1">🖋️ {plan.ink}</h3>
                <p className="text-xs font-bold text-gray-500 mb-6">{plan.desc}</p>
                
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-2xl font-black text-gray-900">{plan.price}</span>
                  <span className="text-sm font-bold text-gray-500 mb-1">원</span>
                </div>
                
                <button className={`w-full py-3 rounded-xl font-black text-sm transition-colors ${
                  plan.popular ? 'bg-violet-600 text-white hover:bg-violet-700' : (plan.best ? 'bg-black text-white hover:bg-gray-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                }`}>
                  선택하기
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📜 [탭 2] 사용 내역 화면 */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4">
          {historyData.length === 0 ? (
            <div className="p-10 text-center text-gray-500 font-bold flex flex-col items-center">
              <History size={40} className="text-gray-300 mb-3" />
              아직 분석한 기록이 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {historyData.map((item) => (
                <div key={item.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <span className="inline-block px-2 py-1 bg-violet-50 text-violet-600 rounded text-[10px] font-black uppercase mb-2">
                      {item.mode} 모드
                    </span>
                    <h4 className="font-black text-gray-900 text-sm mb-1 line-clamp-1">{item.title}</h4>
                    <p className="text-xs font-bold text-gray-400">
                      {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString('ko-KR') : '방금 전'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-gray-900">사용 완료</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 🏦 무통장 입금 및 결제 모달창 */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
              <CreditCard size={20} className="text-violet-600" /> 충전 요청 확인
            </h3>
            
            <div className="bg-gray-50 rounded-2xl p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-bold text-gray-500">요청 잉크</span>
                <span className="text-lg font-black text-gray-900">🖋️ {selectedPlan.ink}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                <span className="text-sm font-bold text-gray-500">결제 금액</span>
                <span className="text-lg font-black text-violet-600">{selectedPlan.price}원</span>
              </div>
              
              <div className="pt-4">
                <span className="text-xs font-bold text-gray-400 block mb-2">입금 계좌 안내 (무통장 입금)</span>
                <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col gap-1">
                  <span className="text-sm font-black text-gray-900">카카오뱅크 3333299690780</span>
                  <span className="text-xs font-bold text-gray-500">예금주: 오*호</span>
                </div>
                <div className="flex items-start gap-2 mt-3 text-red-500 bg-red-50 p-3 rounded-lg">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] font-bold leading-relaxed">
                    하단의 '입금 및 충전 요청' 버튼을 누르신 후 입금해주세요.<br/>관리자 확인 후 10~30분 내로 잉크가 지급됩니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setSelectedPlan(null)} 
                disabled={isRequesting}
                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm hover:bg-gray-200"
              >
                취소
              </button>
              <button 
                onClick={handleChargeRequest}
                disabled={isRequesting}
                className="flex-[2] flex items-center justify-center gap-2 py-4 bg-black text-white rounded-2xl font-black text-sm hover:bg-violet-600 transition-colors shadow-lg"
              >
                {isRequesting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                입금 및 충전 요청
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
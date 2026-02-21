"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { 
  collection, getDocs, query, where, doc, getDoc, 
  onSnapshot, orderBy, getCountFromServer, QuerySnapshot, DocumentData 
} from "firebase/firestore";
import { approveInkRequest } from "@/app/actions/admin-actions";
import toast from "react-hot-toast";
import { Loader2, ShieldAlert, User as UserIcon, Activity, Clock } from "lucide-react";
import Header from "@/components/layout/Header";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'requests' | 'users'>('requests');
  const [requests, setRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null); // ✅ 클릭 지연 방지용
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // 1. 관리자 권한 확인 (클라이언트 사이드)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user && user.email === "ot.helper7@gmail.com") {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
          setIsAdmin(true);
          return;
        }
      }
      setIsAdmin(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 유저 목록 직접 가져오기 (통계 포함)
  const loadUserStats = async () => {
    if (isAdmin !== true) return;
    setLoading(true);
    console.log("🔍 유저 목록 동기화 시도 중..."); // 디버깅용
    
    try {
      const snap = await getDocs(collection(db, "users"));
      console.log(`✅ ${snap.size}명의 유저 발견`);

      const usersData = await Promise.all(snap.docs.map(async (uDoc) => {
        const data = uDoc.data();
        // 각 유저별 지식 라이브러리(분석 횟수) 카운트
        const libQuery = query(collection(db, "knowledge_library"), where("userId", "==", uDoc.id));
        const libSnap = await getCountFromServer(libQuery);
        
        return { 
          id: uDoc.id, 
          ...data, 
          analysisCount: libSnap.data().count,
          email: data.email || "이메일 없음"
        };
      }));
      setUsers(usersData);
    } catch (err: any) {
      console.error("❌ 유저 로딩 실패:", err.message);
      toast.error(`목록 조회 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users' && isAdmin === true) loadUserStats();
  }, [activeTab, isAdmin]);

  // 3. 실시간 충전 요청 감시
  useEffect(() => {
    if (isAdmin !== true) return;
    const q = query(collection(db, "ink_requests"), where("status", "==", "pending"), orderBy("requestedAt", "desc"));
    return onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [isAdmin]);

  // 4. 지급 승인 (Violation 방지 로직)
  const handleApprove = async (req: any) => {
  if (processingId) return;
  if (!confirm(`${req.userEmail}님께 🖋️ ${req.inkAmount} 지급할까요?`)) return;

  setProcessingId(req.id);
  const toastId = toast.loading("잉크를 채우는 중...");

  try {
    // ⚠️ 여기서 req.userId가 실제 유저 문서의 ID(UID)인지 꼭 확인!
    const res = await approveInkRequest(req.id, req.userId, req.inkAmount);
    
    if (res.success) {
      toast.success("지급 완료!", { id: toastId });
      // 목록 실시간 갱신 (이미 처리된 건 제외)
      setRequests(prev => prev.filter(r => r.id !== req.id));
    } else {
      toast.error(`실패: ${res.message}`, { id: toastId });
    }
  } catch (err) {
    toast.error("통신 장애가 발생했습니다.", { id: toastId });
  } finally {
    setProcessingId(null);
  }
};

  if (isAdmin === false) return <div className="p-40 text-center font-black text-red-500 italic">ACCESS DENIED</div>;
  if (isAdmin === null) return <div className="p-40 text-center animate-pulse text-violet-600 font-black italic uppercase tracking-widest">Admin Authenticating...</div>;

  return (
    <div className="bg-[#F9FAFB] min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto p-8 pt-32">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-black text-gray-900 italic tracking-tighter flex items-center gap-3">
            <ShieldAlert size={36} className="text-violet-600" /> 운영 센터
          </h1>
          <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100">
            <button onClick={() => setActiveTab('requests')} className={`px-8 py-3 rounded-xl font-black text-xs transition-all ${activeTab === 'requests' ? 'bg-black text-white' : 'text-gray-400'}`}>Requests ({requests.length})</button>
            <button onClick={() => setActiveTab('users')} className={`px-8 py-3 rounded-xl font-black text-xs transition-all ${activeTab === 'users' ? 'bg-black text-white' : 'text-gray-400'}`}>Researchers ({users.length})</button>
          </div>
        </div>

        {activeTab === 'users' ? (
          <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <tr><th className="px-10 py-6">Researcher</th><th className="px-10 py-6">Ink Balance</th><th className="px-10 py-6">Analytics</th><th className="px-10 py-6">Role</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-violet-50/30 transition-colors">
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400"><UserIcon size={22} /></div>
                        <div><div className="font-black text-gray-900 leading-tight">{u.nickname}</div><div className="text-xs text-gray-400">{u.email}</div></div>
                      </div>
                    </td>
                    <td className="px-10 py-8 font-black text-violet-600 text-xl italic">🖋️ {u.inkBalance || 0}</td>
                    <td className="px-10 py-8 font-bold text-gray-700 tracking-tight"><Activity size={16} className="inline mr-2 text-green-500" /> {u.analysisCount || 0}회</td>
                    <td className="px-10 py-8 text-[10px] font-black uppercase text-gray-300 tracking-widest">{u.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading && <div className="p-32 text-center text-violet-600 font-black animate-pulse italic">SYNCHRONIZING DATA...</div>}
            {!loading && users.length === 0 && <div className="p-32 text-center text-gray-300 font-black italic">데이터가 존재하지 않습니다.</div>}
          </div>
        ) : (
          <div className="grid gap-4">
            {/* 충전 요청 카드 목록 (기존 handleApprove 사용) */}
            {requests.map(req => (
              <div key={req.id} className="bg-white p-8 rounded-[2.5rem] flex justify-between items-center border border-gray-100 shadow-sm">
                <div>
                  <div className="font-black text-gray-900">{req.userEmail}</div>
                  <div className="text-violet-600 font-black text-lg">🖋️ {req.inkAmount} Ink</div>
                </div>
                <button 
                  onClick={() => handleApprove(req)}
                  disabled={processingId === req.id}
                  className="bg-black text-white px-10 py-4 rounded-2xl font-black text-sm hover:bg-violet-600 transition-all disabled:bg-gray-100"
                >
                  {processingId === req.id ? <Loader2 className="animate-spin" /> : "지급 승인"}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
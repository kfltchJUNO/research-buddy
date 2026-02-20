"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { approveInkRequest, getUsersWithStats } from "@/app/actions/admin-actions";
import { Check, User as UserIcon, Activity, Database, Clock } from "lucide-react";
import RollingNumber from "@/components/common/RollingNumber";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'requests' | 'users'>('requests');
  const [requests, setRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. 충전 요청 실시간 리스너
  useEffect(() => {
    const q = query(
      collection(db, "ink_requests"),
      where("status", "==", "pending"),
      orderBy("requestedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, []);

  // 2. 유저 통계 데이터 로드
  const loadUserStats = async () => {
    setLoading(true);
    const res = await getUsersWithStats();
    if (res.success) setUsers(res.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'users') loadUserStats();
  }, [activeTab]);

  const handleApprove = async (req: any) => {
    if (!confirm(`${req.depositorName}님께 ${req.amount} Ink를 지급할까요?`)) return;
    const res = await approveInkRequest(req.id, req.userId, req.amount);
    if (!res.success) alert(res.message);
  };

  return (
    <div className="max-w-7xl mx-auto p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">Admin Center</h1>
          <p className="text-gray-500 font-medium">리서치버디 서비스 운영 및 유저 모니터링</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-xl shadow-sm border">
          <button 
            onClick={() => setActiveTab('requests')}
            className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'requests' ? 'bg-black text-white' : 'text-gray-400'}`}
          >
            충전 요청 ({requests.length})
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'users' ? 'bg-black text-white' : 'text-gray-400'}`}
          >
            유저 관리
          </button>
        </div>
      </div>

      {activeTab === 'requests' ? (
        /* --- 충전 요청 목록 --- */
        <div className="grid gap-4">
          {requests.length === 0 ? (
            <div className="bg-white p-20 rounded-3xl border-2 border-dashed text-center text-gray-400">
              대기 중인 충전 요청이 없습니다.
            </div>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="bg-white p-6 rounded-2xl border shadow-sm flex justify-between items-center group hover:border-black transition-all">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
                    <Database size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-black text-xl">{req.depositorName}</span>
                      <span className="text-sm text-gray-400 font-medium">| {req.requestedAt?.toDate().toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-blue-600 font-bold">🖋️ {req.amount} Ink 요청</span>
                      <span className="text-gray-400">({req.price.toLocaleString()}원 입금 대기)</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleApprove(req)}
                  className="bg-black text-white px-8 py-3 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Check size={18} /> 지급 승인
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        /* --- 유저 목록 및 통계 --- */
        <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                <th className="px-8 py-5">연구자 정보</th>
                <th className="px-8 py-5">보유 잉크</th>
                <th className="px-8 py-5">분석 횟수</th>
                <th className="px-8 py-5">최근 접속</th>
                <th className="px-8 py-5 text-right">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                        <UserIcon size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{user.nickname}</div>
                        <div className="text-xs text-gray-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 font-bold text-blue-600">
                    🖋️ <RollingNumber value={user.inkBalance} />
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 font-bold text-gray-700">
                      <Activity size={16} className="text-green-500" />
                      {user.analysisCount}회
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Clock size={14} />
                      {user.lastLogin?.toDate().toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>
                      {user.role === 'admin' ? '관리자' : '일반'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="p-10 text-center text-gray-400 animate-pulse">데이터를 불러오는 중...</div>}
        </div>
      )}
    </div>
  );
}
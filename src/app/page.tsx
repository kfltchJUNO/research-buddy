"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { runUnifiedAnalysisAction } from "@/app/actions/analyze-action";
import toast from "react-hot-toast";
import { 
  FileUp, Sparkles, Loader2, Files, XCircle, 
  Zap, BrainCircuit, Microscope, CheckCircle2, AlertTriangle, ArrowRight, Info
} from "lucide-react";
import Link from "next/link";

const LOADING_MESSAGES = [
  "AI가 PDF 문서의 텍스트를 스캔하고 있습니다...",
  "표와 그래프 데이터를 시각적으로 분석하는 중입니다...",
  "논문 내의 논리적 흐름과 방법론을 파악하고 있습니다...",
  "학술적 관점에서 한계점과 시사점을 도출하고 있습니다...",
  "거의 다 되었습니다. 최종 리포트를 작성 중입니다..."
];

export default function HomePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null); // ✅ 유저 잉크 정보 실시간 저장
  
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'success' | 'error'>('idle');
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  
  // 🎯 결제(차감) 승인 모달 상태 관리
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    mode: 'scan' | 'understand' | 'think' | null;
    cost: number;
    isFree: boolean;
  }>({ isOpen: false, mode: null, cost: 0, isFree: false });

  const router = useRouter();

  // 🛡️ 로그인 상태 및 유저 데이터 실시간 체크
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        const userRef = doc(db, "users", user.uid);
        const unsubUser = onSnapshot(userRef, (snap) => {
          if (snap.exists()) setUserData(snap.data());
          setAuthLoading(false);
        });
        return () => unsubUser();
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 로딩 텍스트 애니메이션
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'analyzing') {
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleFileChange = (newFiles: File[]) => {
    const pdfFiles = newFiles.filter(f => f.type === "application/pdf");
    if (pdfFiles.length !== newFiles.length) toast.error("PDF 파일만 업로드 가능합니다.");
    setFiles(prev => [...prev, ...pdfFiles]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileChange(Array.from(e.dataTransfer.files));
  };

  // 🚀 1. 분석 버튼 클릭 시 (바로 실행 안 하고 모달 띄움)
  const handleModeSelect = (mode: 'scan' | 'understand' | 'think') => {
    if (files.length === 0) return toast.error("분석할 PDF 파일을 업로드해주세요.");

    const isMulti = files.length > 1;
    const baseCost = isMulti ? 30 : (mode === 'think' ? 15 : 10);
    const isFree = !isMulti && (userData?.hasFreeTrial === true || !userData?.analysisCount || userData?.analysisCount === 0);
    const finalCost = isFree ? 0 : baseCost;

    // 잉크가 부족하면 모달 띄우기 전에 차단
    if (!isFree && (userData?.inkBalance || 0) < finalCost) {
      toast.error(`잉크가 부족합니다. (필요: ${finalCost} / 현재: ${userData?.inkBalance || 0})`);
      return;
    }

    setConfirmModal({ isOpen: true, mode, cost: finalCost, isFree });
  };

  // 🚀 2. 모달에서 '승인' 버튼 눌렀을 때 진짜 실행
  const executeAnalysis = async () => {
    if (!auth.currentUser || !confirmModal.mode) return;
    
    setConfirmModal(prev => ({ ...prev, isOpen: false })); // 모달 닫기
    setStatus('analyzing');
    setLoadingMsgIdx(0);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append("files", f));
      formData.append("userId", auth.currentUser.uid);
      formData.append("mode", confirmModal.mode);

      const res = await runUnifiedAnalysisAction(formData);

      if (res.success && res.data?.docId) {
        setStatus('success');
        setTimeout(() => {
          router.push(`/analysis/${res.data.docId}`);
        }, 1500); 
      } else {
        setStatus('error');
        setErrorMsg(res.message || "알 수 없는 오류가 발생했습니다.");
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg("서버 통신 중 장애가 발생했습니다.");
    }
  };

  if (authLoading) return null;

  return (
    <main className="pt-32 pb-20 px-6 max-w-5xl mx-auto relative">
      
      {/* 🟢 상태 1: 대기 화면 */}
      {status === 'idle' && (
        <div className="animate-in fade-in duration-500">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-black italic tracking-tighter text-gray-900 mb-6">
              Research Faster.<br />Think <span className="text-violet-600 underline decoration-gray-100 underline-offset-8">Deeper.</span>
            </h1>
          </div>

          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`relative bg-white border-2 border-dashed rounded-[4rem] p-16 mb-12 transition-all duration-300 group ${
              isDragging ? "border-violet-500 bg-violet-50/50 scale-[1.01] shadow-2xl shadow-violet-100" : "border-gray-200 hover:border-violet-300 shadow-sm"
            }`}
          >
            <input type="file" multiple accept=".pdf" onChange={(e) => handleFileChange(Array.from(e.target.files || []))} className="hidden" id="pdf-upload" />
            <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center gap-6">
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-500 ${isDragging ? "bg-violet-600 text-white rotate-12" : "bg-gray-50 text-gray-400 group-hover:bg-violet-50 group-hover:text-violet-600"}`}>
                {files.length > 0 ? <Files size={36} /> : <FileUp size={36} />}
              </div>
              <div className="space-y-2 text-center">
                <h3 className="text-xl font-black text-gray-900">
                  {files.length > 0 ? `${files.length}개의 논문 분석 준비 완료` : "분석할 논문을 이곳에 던져주세요"}
                </h3>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">Drag & Drop or Click to Browse PDF</p>
              </div>
            </label>

            {files.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-10 animate-in zoom-in-95 duration-300">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-2xl text-[11px] font-black italic">
                    <span className="truncate max-w-[150px]">{f.name}</span>
                    <button onClick={(e) => { e.preventDefault(); setFiles(files.filter((_, idx) => idx !== i)); }} className="text-gray-400 hover:text-red-400"><XCircle size={14} /></button>
                  </div>
                ))}
                <button onClick={() => setFiles([])} className="px-4 py-2 text-[11px] font-black text-red-500 hover:bg-red-50 rounded-2xl transition-colors">모두 지우기</button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { id: 'scan', label: 'Quick Scan', icon: <Zap size={22} />, desc: '핵심 주제 및 키워드 요약', ink: 10 },
              { id: 'understand', label: 'Understand', icon: <BrainCircuit size={22} />, desc: '논리 구조 및 방법론 파악', ink: 10 },
              { id: 'think', label: 'Deep Think', icon: <Microscope size={22} />, desc: '비판적 분석 및 한계점 도출', ink: 15 },
            ].map((mode) => (
              <button 
                key={mode.id} 
                onClick={() => handleModeSelect(mode.id as any)} // ✅ 바로 실행 안 하고 모달 띄우기
                className="group bg-white border border-gray-100 p-8 rounded-[3rem] hover:bg-black hover:text-white transition-all duration-500 text-left shadow-xl shadow-gray-50"
              >
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-900 mb-6 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                  {mode.icon}
                </div>
                <h4 className="text-lg font-black italic mb-2 uppercase tracking-tighter">{mode.label}</h4>
                <p className="text-xs font-bold text-gray-400 group-hover:text-gray-300 mb-6 leading-relaxed">{mode.desc}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black bg-gray-100 group-hover:bg-gray-800 px-3 py-1 rounded-full transition-colors uppercase">🖋️ {mode.ink} INK</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 🟠 상태 2: 로딩 화면 */}
      {status === 'analyzing' && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in zoom-in-95 duration-500">
          <div className="relative mb-8">
            <div className="w-24 h-24 bg-violet-100 rounded-full animate-ping absolute top-0 left-0 opacity-50" />
            <div className="w-24 h-24 bg-violet-600 rounded-full flex items-center justify-center relative z-10 shadow-2xl shadow-violet-200">
              <Loader2 size={40} className="text-white animate-spin" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">AI가 논문을 딥러닝 중입니다</h2>
          <p className="text-gray-500 font-bold h-6 animate-pulse">{LOADING_MESSAGES[loadingMsgIdx]}</p>
        </div>
      )}

      {/* 🔵 상태 3: 성공 화면 */}
      {status === 'success' && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-green-100">
            <CheckCircle2 size={48} className="text-white" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">분석 완료!</h2>
          <p className="text-gray-500 font-bold">결과 화면으로 이동합니다...</p>
        </div>
      )}

      {/* 🔴 상태 4: 에러 화면 */}
      {status === 'error' && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in zoom-in-95 duration-500 text-center">
          <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-8">
            <AlertTriangle size={40} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-4 tracking-tight">분석을 시작할 수 없습니다</h2>
          <p className="text-gray-500 font-bold mb-8 max-w-md bg-white p-4 rounded-xl border border-gray-100 shadow-sm leading-relaxed">{errorMsg}</p>
          <div className="flex items-center gap-4">
            <button onClick={() => setStatus('idle')} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm hover:bg-gray-200 transition-colors">돌아가기</button>
            {errorMsg.includes("잉크") && (
              <Link href="/library/ink" className="flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-2xl font-black text-sm hover:bg-black transition-colors shadow-xl shadow-violet-100">
                충전소로 이동하기 <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 💳 결제 승인 모달창 (오버레이) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600">
                <Info size={20} />
              </div>
              <h3 className="text-xl font-black text-gray-900">분석을 시작할까요?</h3>
            </div>
            
            <div className="bg-gray-50 rounded-2xl p-6 mb-8 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-500">선택한 모드</span>
                <span className="text-sm font-black text-gray-900 uppercase">{confirmModal.mode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-500">대상 논문</span>
                <span className="text-sm font-black text-gray-900">{files.length}건</span>
              </div>
              <hr className="border-gray-200" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-gray-500">현재 보유 잉크</span>
                <span className="text-sm font-black text-gray-900">🖋️ {userData?.inkBalance || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-black text-gray-900">차감 예정 잉크</span>
                {confirmModal.isFree ? (
                  <span className="text-sm font-black text-violet-600 bg-violet-100 px-2 py-0.5 rounded">무료 혜택 적용</span>
                ) : (
                  <span className="text-sm font-black text-red-500">- 🖋️ {confirmModal.cost}</span>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button 
                onClick={executeAnalysis}
                className="flex-[2] py-4 bg-black text-white rounded-2xl font-black text-sm hover:bg-violet-600 transition-colors shadow-lg shadow-gray-200"
              >
                승인하고 분석 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
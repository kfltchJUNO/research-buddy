"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { 
  doc, onSnapshot, collection, query, where, orderBy, 
  limit, updateDoc, increment, setDoc, addDoc, serverTimestamp 
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { runUnifiedAnalysisAction } from "@/app/actions/analyze-action";
import { runBackgroundPreScan } from "@/app/actions/prescan-action";
import toast from "react-hot-toast";
import { 
  FileUp, Loader2, Files, XCircle, PenTool, GraduationCap, 
  MessageSquare, CheckCircle2, AlertTriangle, Info, Zap, BrainCircuit, 
  Microscope, Lightbulb, BarChart3, Key, ArrowRight, BookOpen, Clock, FileText, ChevronRight, Plus, Coins
} from "lucide-react";
import Link from "next/link";

/**
 * 🚀 분석 깊이 옵션 (Dual-Language)
 */
const DEPTH_LEVELS = [
  { 
    id: 'scan', 
    label: '신속 스캔', 
    labelEn: 'QUICK SCAN',
    icon: <Zap size={24} />, 
    desc: '전체 흐름을 빠르게 파악합니다.', 
    descEn: 'Capture the overall flow instantly.',
    output: '핵심 요약 및 주요 키워드 추출', 
    outputEn: 'Key Summary & Keywords',
    ink: 5, 
    multiInk: 3 
  },
  { 
    id: 'understand', 
    label: '심층 분석', 
    labelEn: 'DEEP UNDERSTAND',
    icon: <BrainCircuit size={24} />, 
    desc: '논문을 완벽하게 내 것으로 만듭니다.', 
    descEn: 'Master the paper thoroughly.',
    output: '연구 구조 상세 분석 및 시각 자료 해석', 
    outputEn: 'Structural & Visual Analysis',
    ink: 15, 
    multiInk: 8 
  },
  { 
    id: 'think', 
    label: '비판적 사고', 
    labelEn: 'CRITICAL THINKING',
    icon: <Microscope size={24} />, 
    desc: '비판적 시각으로 인사이트를 얻습니다.', 
    descEn: 'Gain deep insights via critique.',
    output: '연구 방법론 비판 및 후속 연구 방향 제안', 
    outputEn: 'Methodology Critique & Directions',
    ink: 25, 
    multiInk: 12 
  }
];

const STYLE_OPTIONS = [
  { id: 'academic', label: '논문형', labelEn: 'ACADEMIC', icon: <PenTool size={16}/>, desc: '격식 있는 학술적 톤 (Formal)' },
  { id: 'lecture', label: '강의형', labelEn: 'LECTURE', icon: <GraduationCap size={16}/>, desc: '친절한 설명 방식 (Explanatory)' },
  { id: 'blog', label: '블로그형', labelEn: 'BLOG/SUMMARY', icon: <MessageSquare size={16}/>, desc: '가독성 높은 요약 (Readable)' }
];

const LOADING_MESSAGES = [
  "AI가 PDF 텍스트를 스캔하고 있습니다... (Scanning Text...)",
  "표와 그래프 데이터를 시각적으로 분석하는 중입니다... (Analyzing Data...)",
  "논문 내 논리적 흐름과 방법론을 파악하고 있습니다... (Parsing Logic...)",
  "학술적 관점에서 인사이트를 도출 중... (Deriving Insights...)",
  "거의 다 되었습니다. 리포트를 작성 중입니다... (Generating Report...)"
];

export default function HomePage() {
  const router = useRouter();
  
  // 1. 상태 관리
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [recentDocs, setRecentDocs] = useState<any[]>([]); 
  
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'success' | 'error'>('idle');
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [pdfMeta, setPdfMeta] = useState({ pages: 0, chars: 0 });
  const [preScanData, setPreScanData] = useState<any>(null);
  const [isPreScanning, setIsPreScanning] = useState(false);
  const [sourceText, setSourceText] = useState("");

  const [selectedMode, setSelectedMode] = useState(DEPTH_LEVELS[1]);
  const [selectedStyle, setSelectedStyle] = useState('academic');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [addons, setAddons] = useState({ visualization: false, deepKeyword: false });
  
  const [confirmModal, setConfirmModal] = useState<any>(null);
  const [isRecharging, setIsRecharging] = useState(false);

  // 2. 인증 및 데이터 실시간 구독
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAuthLoading(false);
        router.replace("/login");
      } else {
        const userRef = doc(db, "users", user.uid);
        const unsubUser = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setUserData(snap.data());
          } else {
            setDoc(userRef, {
              email: user.email,
              inkBalance: 50,
              analysisCount: 0,
              role: user.email === 'ot.helper7@gmail.com' ? 'admin' : 'user',
              createdAt: serverTimestamp()
            });
          }
          setAuthLoading(false);
        }, (err) => {
          console.error("🔥 Firestore Users Error:", err.message);
          setAuthLoading(false);
        });

        const q = query(
          collection(db, "knowledge_library"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(3)
        );
        const unsubDocs = onSnapshot(q, (snap) => {
          setRecentDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => {
          console.error("🔥 Firestore Library Error:", err.message);
        });

        return () => { unsubUser(); unsubDocs(); };
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  // 3. 충전 로직 (어드민 전용 필터링)
  const isAdminUser = userData?.role === 'admin' || auth.currentUser?.email === 'ot.helper7@gmail.com';

  const handleRechargeInk = async (amount: number) => {
    if (!auth.currentUser || !userData || !isAdminUser) return;
    setIsRecharging(true);
    const loadingToast = toast.loading(`[ADMIN] Charging ${amount} INK...`);
    try {
      const uid = auth.currentUser.uid;
      await updateDoc(doc(db, "users", uid), { inkBalance: increment(amount) });
      await addDoc(collection(db, "recharge_requests"), {
        userId: uid, userEmail: auth.currentUser.email, amount, status: 'completed', type: 'admin_instant', createdAt: serverTimestamp()
      });
      toast.success(`Charged!`, { id: loadingToast });
      if (confirmModal) setConfirmModal(null);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`, { id: loadingToast });
    } finally {
      setIsRecharging(false);
    }
  };

  // 4. 로딩 텍스트 애니메이션 (4.5초 간격)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'analyzing') {
      interval = setInterval(() => setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length), 4500);
    }
    return () => clearInterval(interval);
  }, [status]);

  // 🚀 5. [핵심 해결] PDF 엔진 (Tracking Prevention 우회 및 TS 에러 해결)
  const handleFileChange = async (newFiles: File[]) => {
    const pdfFiles = newFiles.filter(f => f.type === "application/pdf");
    if (pdfFiles.length === 0) return toast.error("PDF files only.");
    setFiles(pdfFiles);
    setPreScanData(null);
    setPdfMeta({ pages: 0, chars: 0 });
    setSourceText("");
    
    toast.loading("Analyzing Paper...", { id: 'parsing' });
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

      let totalPages = 0;
      let totalChars = 0;
      let fullText = "";

      for (const file of pdfFiles) {
        const arrayBuffer = await file.arrayBuffer();
        
        // 🚀 [해결 포인트] @ts-ignore 사용하여 disableWorker 인식 오류 해결 (TS2353)
        // 브라우저 보안 정책에 상관없이 메인 스레드에서 즉시 파싱하도록 강제함
        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer, 
          // @ts-ignore
          disableWorker: true, 
          verbosity: 0 
        });

        const pdf = await loadingTask.promise;
        totalPages += pdf.numPages;
        for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          if (i <= 5) totalChars += pageText.length; 
          fullText += pageText + " "; 
        }
        if (pdf.numPages > 5) totalChars = Math.floor((totalChars / 5) * pdf.numPages);
      }
      setPdfMeta({ pages: totalPages, chars: totalChars });
      setSourceText(fullText);
      toast.success(`${totalPages}P Measured!`, { id: 'parsing' });

      if (pdfFiles.length === 1) {
        setIsPreScanning(true);
        const base64 = Buffer.from(await pdfFiles[0].arrayBuffer()).toString("base64");
        const scanRes = await runBackgroundPreScan(base64, pdfFiles[0].type);
        if (scanRes.success) setPreScanData(scanRes.data);
        setIsPreScanning(false);
      }
    } catch (err: any) {
      console.error("🔥 PDF Engine Critical Error:", err);
      toast.error("Security blocked PDF parsing.", { id: 'parsing' });
    }
  };

  // 6. 청구서 계산 및 모달 오픈
  const handleOpenModal = () => {
    if (files.length === 0) return toast.error("Select papers first.");
    const isMulti = files.length > 1;
    const baseCost = isMulti ? 10 + (files.length * selectedMode.multiInk) : selectedMode.ink;
    const totalCost = baseCost + (pdfMeta.pages > 100 ? 5 : 0) + (pdfMeta.chars > 50000 ? 4 : 0) + (addons.visualization ? 5 : 0);
    const inkBalance = userData?.inkBalance || 0;
    const isFree = !isMulti && (userData?.hasFreeTrial === true || !userData?.analysisCount);
    const isShortage = !isFree && inkBalance < totalCost;
    setConfirmModal({ isOpen: true, baseCost, totalCost, isShortage, inkBalance, isFree });
  };

  // 🚀 7. 최종 분석 실행 (에러 핸들링 강화)
  const executeAnalysis = async () => {
    if (!confirmModal || confirmModal.isShortage) return;
    setStatus('analyzing');
    const { totalCost } = confirmModal;
    setConfirmModal(null);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append("files", f));
      formData.append("userId", auth.currentUser!.uid);
      formData.append("mode", selectedMode.id);
      formData.append("style", selectedStyle);
      formData.append("totalCost", totalCost.toString());
      formData.append("addons", JSON.stringify(addons));
      formData.append("sourceText", sourceText);

      const res = await runUnifiedAnalysisAction(formData);

      if (res.success && res.data) {
        setStatus('success');
        setTimeout(() => router.push(`/analysis/${res.data.docId}`), 1500); 
      } else {
        // 🚨 7 PERMISSION_DENIED 오류 감지 시점
        console.error("❌ 분석 실패 (응답 에러):", res.message);
        setStatus('error');
        setErrorMsg(res.message || "Permission Denied: Please check Firestore Rules.");
      }
    } catch (err: any) {
      console.error("🔥 분석 서버 통신 에러:", err);
      setStatus('error');
      setErrorMsg(err.message || "Communication failure.");
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-violet-600" size={40} /></div>;

  return (
    <main className="pt-32 pb-32 px-6 max-w-5xl mx-auto font-sans selection:bg-violet-100 selection:text-violet-900">
      {status === 'idle' && (
        <div className="animate-in fade-in duration-1000">
          
          {/* 🔘 히어로 & 보유 잉크 바 (KR/EN Dual) */}
          <div className="text-center mb-16">
            <h1 className="text-7xl font-black italic tracking-tighter text-gray-900 mb-4 uppercase leading-none break-keep">
              Everything starts<br/><span className="text-violet-600">질문으로부터 시작됩니다.</span>
            </h1>
            <div className="flex items-center justify-center gap-4 mt-10">
               <div className="bg-white border-2 border-gray-100 px-10 py-4 rounded-[2.5rem] flex items-center gap-6 shadow-sm">
                  <div className="flex flex-col items-start border-r-2 border-gray-50 pr-6">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mb-1 italic">Balance / 보유 잉크</span>
                    <span className="text-3xl font-black text-violet-600 leading-none italic italic">🖋️ {userData?.inkBalance || 0}</span>
                  </div>
                  {isAdminUser && (
                    <button onClick={() => handleRechargeInk(100)} disabled={isRecharging} className="bg-black text-white px-8 py-3 rounded-2xl font-black text-xs hover:bg-violet-600 transition-all flex items-center gap-3 active:scale-95 shadow-xl shadow-gray-200">
                      {isRecharging ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} RECHARGE
                    </button>
                  )}
               </div>
            </div>
          </div>

          {/* 📥 드롭존 (Dual) */}
          <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileChange(Array.from(e.dataTransfer.files)); }} className={`relative bg-white border-2 border-dashed rounded-[4rem] p-20 mb-16 text-center transition-all duration-500 ${isDragging ? "border-violet-500 bg-violet-50 scale-[1.02]" : "border-gray-200 hover:border-violet-300 shadow-sm"}`}>
            <input type="file" multiple accept=".pdf" onChange={(e) => handleFileChange(Array.from(e.target.files || []))} className="hidden" id="pdf-upload" />
            <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
              <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center mb-8 transition-all ${files.length > 0 ? "bg-violet-600 text-white shadow-2xl" : "bg-gray-50 text-gray-400"}`}><Files size={40} /></div>
              <h3 className="text-3xl font-black text-gray-900 leading-tight italic">{files.length > 0 ? `${files.length} Papers Measured / 분석 대기` : "Upload Research Papers / 논문 업로드"}</h3>
              <p className="text-[11px] text-gray-400 mt-4 font-bold uppercase tracking-[0.3em] italic opacity-60">PDF files only. Auto-deleted after 1 hour.</p>
            </label>
            {files.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 mt-12 animate-in zoom-in-95">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 bg-black text-white px-6 py-3 rounded-2xl text-[10px] font-black italic shadow-lg hover:bg-violet-600 transition-colors group">
                    <span className="truncate max-w-[150px] uppercase tracking-tighter">{f.name}</span>
                    <button onClick={(e) => { e.preventDefault(); setFiles(files.filter((_, idx) => idx !== i)); }} className="text-gray-500 hover:text-white"><XCircle size={18} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ⚙️ 상세 설정 (깊이, 추가 옵션, 스타일) */}
          <div className="max-w-4xl mx-auto space-y-28">
            <section>
              <h3 className="font-black text-3xl mb-12 text-gray-900 flex items-center gap-6 italic tracking-tighter uppercase"><span className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center text-sm font-black shadow-lg">1</span> Analysis Depth / 분석 깊이</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {DEPTH_LEVELS.map((mode) => (
                  <button key={mode.id} onClick={() => setSelectedMode(mode)} className={`flex flex-col bg-white border-2 p-10 rounded-[3.5rem] text-left transition-all duration-500 relative overflow-hidden group ${selectedMode.id === mode.id ? 'border-violet-600 ring-[15px] ring-violet-50 shadow-2xl scale-[1.03]' : 'border-gray-100 hover:border-violet-200 shadow-sm'}`}>
                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-8 transition-all duration-500 group-hover:rotate-6 ${selectedMode.id === mode.id ? 'bg-violet-600 text-white shadow-lg' : 'bg-gray-50'}`}>{mode.icon}</div>
                    <div className="flex flex-col mb-4"><span className="text-[10px] font-black text-violet-500 uppercase tracking-[0.2em] mb-1 italic">{mode.labelEn}</span><h4 className="text-2xl font-black italic uppercase tracking-tighter leading-tight">{mode.label}</h4></div>
                    <p className="text-[11px] font-bold text-gray-500 mb-10 leading-relaxed h-14 italic">{mode.desc}<br/>{mode.descEn}</p>
                    <div className="font-black text-[11px] uppercase tracking-widest bg-gray-100 px-5 py-2.5 rounded-xl self-start italic">🖋️ {mode.ink} INK</div>
                  </button>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              <section>
                <h3 className="font-black text-2xl mb-10 text-gray-900 flex items-center gap-5 italic tracking-tighter uppercase"><span className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-sm font-black shadow-lg">2</span> Add-ons / 추가 옵션</h3>
                <div className="space-y-6">
                  <label className={`flex items-center gap-6 p-8 rounded-[2.5rem] border-2 cursor-pointer transition-all duration-300 ${addons.visualization ? 'border-violet-600 bg-violet-50 shadow-lg' : 'border-gray-100 bg-white hover:border-gray-200 shadow-sm'}`}>
                    <input type="checkbox" className="hidden" checked={addons.visualization} onChange={() => setAddons(p => ({...p, visualization: !p.visualization}))}/>
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${addons.visualization ? "bg-violet-600 text-white shadow-lg" : "bg-gray-50 text-gray-400"}`}><BarChart3 size={32} /></div>
                    <div><p className="font-black text-xl text-gray-900 leading-tight italic uppercase">Visual Analysis</p><p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1 italic">+ 5 INK</p></div>
                  </label>
                  <label className={`flex items-center gap-6 p-8 rounded-[2.5rem] border-2 cursor-pointer transition-all duration-300 ${addons.deepKeyword ? 'border-violet-600 bg-violet-50 shadow-lg' : 'border-gray-100 bg-white hover:border-gray-200 shadow-sm'}`}>
                    <input type="checkbox" className="hidden" checked={addons.deepKeyword} onChange={() => setAddons(p => ({...p, deepKeyword: !p.deepKeyword}))}/>
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${addons.deepKeyword ? "bg-violet-600 text-white shadow-lg" : "bg-gray-50 text-gray-400"}`}><Key size={32} /></div>
                    <div><p className="font-black text-xl text-gray-900 leading-tight italic uppercase">Keyword Deep-Dive</p><p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1 italic">+ 5 INK</p></div>
                  </label>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-10 px-4">
                  <h3 className="font-black text-2xl text-gray-900 flex items-center gap-5 italic tracking-tighter uppercase"><span className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-sm font-black shadow-lg">3</span> Style / 스타일</h3>
                  <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-[10px] font-black text-gray-400 bg-gray-100 px-6 py-2.5 rounded-xl hover:bg-gray-200 transition-all uppercase italic">Change</button>
                </div>
                {showAdvanced ? (
                  <div className="grid grid-cols-1 gap-4 animate-in slide-in-from-top-4">
                    {STYLE_OPTIONS.map(opt => (
                      <button key={opt.id} onClick={() => { setSelectedStyle(opt.id); setShowAdvanced(false); }} className={`flex items-center gap-6 p-8 rounded-[2.5rem] border-2 text-left transition-all ${selectedStyle === opt.id ? 'border-violet-600 bg-violet-50 text-violet-700 shadow-md' : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200 shadow-sm'}`}>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selectedStyle === opt.id ? 'bg-violet-600 text-white' : 'bg-gray-50'}`}>{opt.icon}</div>
                        <div><div className="font-black text-lg uppercase tracking-tighter italic">{opt.labelEn}</div><div className="text-[10px] opacity-60 font-bold italic">{opt.label}</div></div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col justify-center bg-gray-50 px-10 py-12 rounded-[2.5rem] border-2 border-dashed border-gray-100 italic group hover:border-violet-200 transition-all text-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mb-4 italic">Selected Output Style</span>
                    <div className="flex items-center justify-center gap-5 text-violet-600"><PenTool size={32} /><div className="text-3xl font-black uppercase tracking-tighter italic">{selectedStyle}</div></div>
                  </div>
                )}
              </section>
            </div>

            <button onClick={handleOpenModal} className="w-full py-14 bg-black text-white rounded-[4rem] font-black text-4xl shadow-[0_30px_100px_rgba(0,0,0,0.2)] hover:bg-violet-600 hover:-translate-y-3 transition-all flex items-center justify-center gap-10 uppercase tracking-tighter group overflow-hidden relative">
              <span className="relative z-10 italic">RUN COMPREHENSIVE ANALYSIS / 분석 시작</span>
              <ArrowRight size={56} className="group-hover:translate-x-4 transition-transform relative z-10"/>
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            </button>
          </div>

          {/* 📜 최근 연구 서재 */}
          <div className="max-w-4xl mx-auto mt-56">
            <h3 className="font-black text-5xl text-gray-900 mb-16 px-10 border-b-2 border-gray-50 pb-12 italic uppercase tracking-tighter"><Clock className="text-violet-600" size={48} /> Recent Stacks / 최근 서재</h3>
            <div className="space-y-10">
              {recentDocs.map((doc) => (
                <Link key={doc.id} href={`/analysis/${doc.id}`} className="flex items-center justify-between bg-white border-2 border-gray-100 p-12 rounded-[4.5rem] hover:border-violet-300 hover:shadow-2xl transition-all group relative overflow-hidden">
                  <div className="flex items-center gap-12 relative z-10"><div className="w-24 h-24 bg-gray-50 rounded-[2.5rem] flex items-center justify-center text-gray-300 group-hover:bg-violet-600 group-hover:text-white transition-all duration-500 shadow-sm"><FileText size={48} /></div><div className="font-black text-gray-900 text-3xl italic uppercase uppercase italic">{doc.title}</div></div>
                  <ChevronRight size={40} className="text-gray-200 group-hover:text-violet-600 transition-all group-hover:translate-x-4" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🧾 청구서 및 잉크 충전 모달 */}
      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-2xl px-4 animate-in fade-in duration-500">
          <div className="bg-white rounded-[5rem] p-16 w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden text-center italic">
            <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 animate-pulse"></div>
            <h3 className="text-5xl font-black text-gray-900 mb-14 italic underline decoration-violet-500 underline-offset-8 decoration-8 uppercase tracking-tighter italic text-center italic">Analysis Bill / 청구서</h3>
            <div className="bg-gray-50 rounded-[3.5rem] p-12 mb-16 space-y-8 font-bold text-lg shadow-inner text-left italic">
              <div className="flex justify-between items-center"><span className="text-[11px] text-gray-400 uppercase tracking-[0.3em] italic leading-none">REQUIRED INK</span><span className="text-gray-900 font-black text-xl italic italic">🖋️ {confirmModal.totalCost}</span></div>
              <div className="flex justify-between items-center"><span className="text-[11px] text-gray-400 uppercase tracking-[0.3em] italic leading-none">YOUR BALANCE</span><span className={confirmModal.isShortage ? "text-red-500 font-black text-xl italic italic" : "text-gray-900 font-black text-xl italic italic"}>🖋️ {confirmModal.inkBalance}</span></div>
              <hr className="border-gray-200 my-10" />
              <div className="flex justify-between items-center italic italic">
                <span className="text-gray-900 font-black text-2xl uppercase">Final Ink To Deduct</span>
                <span className="text-6xl font-black text-violet-600 tracking-tighter italic italic">🖋️ {confirmModal.isFree ? 'FREE' : confirmModal.totalCost}</span>
              </div>
              {confirmModal.isShortage && (
                <div className="bg-red-600 p-8 rounded-[2.5rem] text-white text-[12px] flex items-center gap-6 font-black leading-relaxed mt-10 shadow-2xl animate-in slide-in-from-top-6 ring-8 ring-red-50">
                   <AlertTriangle size={48} className="shrink-0 animate-bounce" />
                   <div>{isAdminUser ? "잉크가 부족합니다. 즉시 충전하세요!" : "보유 잉크가 부족합니다. 관리자에게 문의하세요!"}</div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-6">
              {confirmModal.isShortage ? (
                isAdminUser ? <button onClick={() => handleRechargeInk(100)} disabled={isRecharging} className="w-full py-9 bg-violet-600 text-white rounded-[3rem] font-black text-3xl flex items-center justify-center gap-6 hover:bg-violet-700 active:scale-95 shadow-xl uppercase italic italic">{isRecharging ? <Loader2 className="animate-spin" size={32}/> : <Plus size={36}/>} Instant Recharge</button>
                : <div className="bg-gray-100 p-8 rounded-[2rem] text-gray-400 font-black text-center text-sm italic italic">Contact Admin to Recharge</div>
              ) : (
                <button onClick={executeAnalysis} className="w-full py-9 bg-black text-white rounded-[3rem] font-black text-3xl hover:bg-violet-600 active:scale-95 uppercase tracking-tighter transition-all italic italic italic">Confirm & Start / 시작</button>
              )}
              <button onClick={() => setConfirmModal(null)} className="w-full py-5 bg-gray-100 text-gray-500 rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.5em] hover:bg-gray-200 transition-all">Cancel / 분석 취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 🌀 분석 중 로딩 애니메이션 */}
      {status === 'analyzing' && (
        <div className="flex flex-col items-center justify-center min-h-[75vh] animate-in zoom-in-95 duration-1000 italic italic">
          <div className="relative mb-28">
            <div className="w-64 h-64 bg-violet-100 rounded-full animate-ping absolute top-0 left-0 opacity-40" />
            <div className="w-64 h-64 bg-violet-600 rounded-full flex items-center justify-center relative z-10 shadow-[0_0_150px_rgba(139,92,246,0.6)] border-[15px] border-white/20">
              <Loader2 size={120} className="text-white animate-spin" />
            </div>
            <div className="absolute -top-10 -right-10 animate-bounce duration-[2000ms]"><Lightbulb size={64} className="text-yellow-400 drop-shadow-lg" /></div>
            <div className="absolute -bottom-10 -left-10 animate-bounce duration-[3000ms]"><BrainCircuit size={64} className="text-violet-400 drop-shadow-lg" /></div>
          </div>
          <h2 className="text-6xl font-black text-gray-900 mb-12 uppercase tracking-tighter italic text-center leading-none italic italic">Extracting Wisdom...<br/><span className="text-3xl text-violet-600 mt-4 block not-italic font-bold">지식을 추출하는 중입니다.</span></h2>
          <div className="bg-white border-2 border-gray-100 px-16 py-12 rounded-[4rem] shadow-2xl max-w-xl mx-auto text-center italic italic">
            <p className="text-gray-600 font-black h-16 animate-pulse italic text-2xl leading-relaxed">{LOADING_MESSAGES[loadingMsgIdx]}</p>
            <div className="w-full bg-gray-100 h-3 rounded-full mt-10 overflow-hidden shadow-inner"><div className="bg-violet-600 h-full animate-[loading-bar_15s_ease-in-out_infinite]" style={{ width: '100%' }}></div></div>
          </div>
          <style jsx>{` @keyframes loading-bar { 0% { width: 0%; } 100% { width: 100%; } } `}</style>
        </div>
      )}

      {/* 🎉 분석 성공 화면 */}
      {status === 'success' && (
        <div className="flex flex-col items-center justify-center min-h-[75vh] animate-in zoom-in-95 duration-700 italic italic">
          <div className="w-64 h-64 bg-green-500 rounded-[5rem] flex items-center justify-center mb-24 shadow-[0_40px_100px_rgba(34,197,94,0.4)] animate-bounce"><CheckCircle2 size={140} className="text-white" /></div>
          <h2 className="text-8xl font-black text-gray-900 mb-8 italic uppercase tracking-tighter leading-none italic italic text-center">SUCCESS!</h2>
          <p className="text-gray-500 font-bold text-3xl uppercase tracking-[0.5em] opacity-60 text-center uppercase tracking-widest italic">Redirecting Dashboard / 분석 완료</p>
        </div>
      )}

      {/* 🚨 에러 화면 (최종 보호막) */}
      {status === 'error' && (
        <div className="flex flex-col items-center justify-center min-h-[75vh] text-center animate-in fade-in duration-500 px-10 italic italic">
          <div className="w-64 h-64 bg-red-50 rounded-[5rem] flex items-center justify-center mb-20 shadow-2xl shadow-red-100/50 group"><AlertTriangle size={100} className="text-red-500 group-hover:rotate-12 transition-transform" /></div>
          <h2 className="text-6xl font-black text-gray-900 mb-10 uppercase tracking-tighter italic leading-none italic italic">Analysis Failed</h2>
          <p className="text-gray-600 font-black mb-20 max-w-2xl mx-auto leading-relaxed bg-white p-12 rounded-[4rem] border-4 border-red-50 shadow-2xl text-2xl uppercase italic italic italic">{errorMsg}</p>
          <button onClick={() => setStatus('idle')} className="px-20 py-10 bg-black text-white rounded-[3.5rem] font-black text-3xl uppercase tracking-widest hover:bg-violet-600 transition-all shadow-2xl active:scale-95 italic italic italic">Back to Home / 다시 시도</button>
        </div>
      )}
    </main>
  );
}
"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, collection, query, where, orderBy, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { runUnifiedAnalysisAction } from "@/app/actions/analyze-action";
import { runBackgroundPreScan } from "@/app/actions/prescan-action";
import toast from "react-hot-toast";
import { 
  FileUp, Loader2, Files, XCircle, PenTool, GraduationCap, 
  MessageSquare, CheckCircle2, AlertTriangle, Info, Zap, BrainCircuit, 
  Microscope, Lightbulb, BarChart3, Key, ArrowRight, BookOpen, Clock, FileText, ChevronRight
} from "lucide-react";
import Link from "next/link";

// 🚀 인상된 요금제 및 수익 모델 데이터
const DEPTH_LEVELS = [
  { id: 'scan', label: 'Quick Scan', icon: <Zap size={24} />, desc: '전체 흐름을 빠르게 파악합니다.', output: '핵심 요약 및 주요 키워드 추출', ink: 5, multiInk: 3 },
  { id: 'understand', label: 'Understand', icon: <BrainCircuit size={24} />, desc: '논문을 완벽하게 내 것으로 만듭니다.', output: '연구 구조 상세 분석 및 시각 자료 해석', ink: 15, multiInk: 8 },
  { id: 'think', label: 'Deep Think', icon: <Microscope size={24} />, desc: '비판적 시각으로 인사이트를 얻습니다.', output: '연구 방법론 비판 및 후속 연구 방향 제안', ink: 25, multiInk: 12 }
];

const STYLE_OPTIONS = [
  { id: 'academic', label: '논문형', icon: <PenTool size={16}/>, desc: '격식 있는 학술적 톤' },
  { id: 'lecture', label: '강의형', icon: <GraduationCap size={16}/>, desc: '학생에게 설명하듯 친절하게' },
  { id: 'blog', label: '블로그형', icon: <MessageSquare size={16}/>, desc: '가독성 높은 흥미로운 톤' }
];

const LOADING_MESSAGES = [
  "AI가 PDF 문서의 텍스트를 스캔하고 있습니다...",
  "표와 그래프 데이터를 시각적으로 분석하는 중입니다...",
  "논문 내의 논리적 흐름과 방법론을 파악하고 있습니다...",
  "학술적 관점에서 한계점과 시사점을 도출하고 있습니다...",
  "거의 다 되었습니다. 최종 리포트를 작성 중입니다..."
];

export default function HomePage() {
  const router = useRouter();
  
  // 상태 관리 세트
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [recentDocs, setRecentDocs] = useState<any[]>([]); // 최근 연구 노트 데이터
  
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

  // 🚀 [핵심] 인증 및 실시간 데이터 통합 구독 로직
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAuthLoading(false);
        router.replace("/login");
      } else {
        // 1. 유저 프로필 실시간 구독
        const userRef = doc(db, "users", user.uid);
        const unsubUser = onSnapshot(userRef, (snap) => {
          if (snap.exists()) setUserData(snap.data());
          setAuthLoading(false);
        }, (err) => {
          console.error("유저 데이터 로드 실패:", err);
          setAuthLoading(false);
        });

        // 2. 최근 연구 노트 (3건) 실시간 구독
        const q = query(
          collection(db, "knowledge_library"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(3)
        );
        const unsubDocs = onSnapshot(q, (snap) => {
          setRecentDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => {
          console.error("최근 문서 로드 실패:", err);
        });

        return () => { unsubUser(); unsubDocs(); };
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 로딩 메시지 애니메이션
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'analyzing') {
      interval = setInterval(() => setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length), 4000);
    }
    return () => clearInterval(interval);
  }, [status]);

  // 📄 파일 핸들링 및 메타데이터 추출
  const handleFileChange = async (newFiles: File[]) => {
    const pdfFiles = newFiles.filter(f => f.type === "application/pdf");
    if (pdfFiles.length === 0) return toast.error("PDF 파일만 업로드 가능합니다.");
    
    setFiles(pdfFiles);
    setPreScanData(null);
    setPdfMeta({ pages: 0, chars: 0 });
    setSourceText("");
    
    toast.loading("논문 분량 측정 중...", { id: 'parsing' });
    try {
      // @ts-ignore
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      let totalPages = 0;
      let totalChars = 0;
      let fullExtractedText = "";

      for (const file of pdfFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        totalPages += pdf.numPages;
        
        // 텍스트 추출 (RAG 및 할증 계산용)
        for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(" ");
          if (i <= 5) totalChars += pageText.length; 
          fullExtractedText += pageText + " "; 
        }
        if (pdf.numPages > 5) totalChars = Math.floor((totalChars / 5) * pdf.numPages);
      }
      
      setPdfMeta({ pages: totalPages, chars: totalChars });
      setSourceText(fullExtractedText);
      toast.success(`측정 완료: ${totalPages}P / 약 ${totalChars.toLocaleString()}자`, { id: 'parsing' });

      // 단일 파일일 경우 AI Pre-Scan 진행
      if (pdfFiles.length === 1) {
        setIsPreScanning(true);
        const base64 = Buffer.from(await pdfFiles[0].arrayBuffer()).toString("base64");
        const scanRes = await runBackgroundPreScan(base64, pdfFiles[0].type);
        if (scanRes.success) {
          setPreScanData(scanRes.data);
          const rec = DEPTH_LEVELS.find(m => m.id === scanRes.data.recommendMode?.toLowerCase());
          if (rec) setSelectedMode(rec);
        }
        setIsPreScanning(false);
      }
    } catch (err) {
      toast.error("파일 분석 중 오류가 발생했습니다.");
    }
  };

  // 🖋️ 잉크 계산 및 모달 오픈
  const handleOpenModal = () => {
    if (files.length === 0) return toast.error("분석할 파일을 선택해주세요.");

    const isMulti = files.length > 1;
    const baseCost = isMulti ? 10 + (files.length * selectedMode.multiInk) : selectedMode.ink;
    
    // 할증 로직
    const pageSurcharge = pdfMeta.pages > 100 ? 5 : 0;
    const textSurcharge = pdfMeta.chars > 50000 ? Math.ceil((pdfMeta.chars - 50000) / 20000) * 2 : 0;
    const addonCost = (addons.visualization ? 5 : 0) + (addons.deepKeyword ? 5 : 0);
    
    const totalCost = baseCost + pageSurcharge + textSurcharge + addonCost;
    const isFree = !isMulti && (userData?.hasFreeTrial || !userData?.analysisCount);

    if (!isFree && (userData?.inkBalance || 0) < totalCost) {
      return toast.error(`잉크가 부족합니다. (필요: ${totalCost} / 현재: ${userData?.inkBalance || 0})`);
    }

    setConfirmModal({ isOpen: true, modeData: selectedMode, baseCost, pageSurcharge, textSurcharge, addonCost, totalCost, isFree });
  };

  // 🚀 최종 분석 실행
  const executeAnalysis = async () => {
    if (!confirmModal) return;
    const { totalCost } = confirmModal;
    setStatus('analyzing');
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
        if (res.data.refundReason) toast.success(res.data.refundReason, { duration: 6000, icon: '💸' });
        setTimeout(() => router.push(`/analysis/${res.data.docId}`), 1500); 
      } else {
        setStatus('error');
        setErrorMsg(res.message || "분석 서버 응답 실패");
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg("서버 통신 중 장애가 발생했습니다.");
    }
  };

  // 인증 로딩 가드
  if (authLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-violet-600 mb-4" size={40} />
      <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Verifying Identity...</p>
    </div>
  );

  return (
    <main className="pt-32 pb-32 px-6 max-w-5xl mx-auto">
      {status === 'idle' && (
        <div className="animate-in fade-in duration-700">
          
          {/* 히어로 타이틀 */}
          <div className="text-center mb-16">
            <h1 className="text-6xl font-black italic tracking-tighter text-gray-900 mb-4 uppercase leading-none">이 논문, 어디까지<br/>이해하고 싶으세요?</h1>
            <p className="text-gray-400 font-bold text-sm tracking-widest uppercase italic">"우리는 답이 아니라, 생각을 만듭니다."</p>
          </div>

          {/* 📤 파일 드롭존 */}
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileChange(Array.from(e.dataTransfer.files)); }}
            className={`relative bg-white border-2 border-dashed rounded-[3.5rem] p-16 mb-12 text-center transition-all duration-300 ${isDragging ? "border-violet-500 bg-violet-50 scale-[1.02]" : "border-gray-200 hover:border-violet-300"}`}
          >
            <input type="file" multiple accept=".pdf" onChange={(e) => handleFileChange(Array.from(e.target.files || []))} className="hidden" id="pdf-upload" />
            <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
              <div className={`w-20 h-20 rounded-[2.5rem] flex items-center justify-center mb-6 transition-all ${files.length > 0 ? "bg-violet-600 text-white shadow-2xl shadow-violet-200" : "bg-gray-50 text-gray-400"}`}>
                {files.length > 0 ? <Files size={36} /> : <FileUp size={36} />}
              </div>
              <h3 className="text-2xl font-black text-gray-900">{files.length > 0 ? `${files.length}건의 논문 준비됨` : "분석할 논문 선택"}</h3>
              <p className="text-sm text-gray-400 mt-3 font-medium italic">당신의 지식은 분석 1시간 후 영구히 파기됩니다.</p>
            </label>
            
            {files.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-8 animate-in zoom-in-95">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-[11px] font-black italic">
                    <span className="truncate max-w-[150px]">{f.name}</span>
                    <button onClick={(e) => { e.preventDefault(); setFiles(files.filter((_, idx) => idx !== i)); }} className="text-gray-500 hover:text-red-400"><XCircle size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 💡 Pre-Scan 카드 */}
          {isPreScanning && <div className="max-w-4xl mx-auto mb-12 p-8 bg-violet-50 rounded-3xl animate-pulse text-center font-black text-violet-600">AI가 논문의 골격을 선행 스캔 중입니다...</div>}
          {preScanData && (
            <div className="max-w-4xl mx-auto mb-16 p-10 bg-gradient-to-br from-violet-600 to-indigo-900 text-white rounded-[3.5rem] shadow-2xl animate-in slide-in-from-bottom-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-10"><Lightbulb size={160} /></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-6 text-violet-200 font-black tracking-widest text-xs uppercase"><Zap size={16}/> Pre-Scan Summary</div>
                <h3 className="text-3xl font-black mb-8 leading-tight italic break-keep">"{preScanData.summary}"</h3>
                <div className="flex flex-wrap gap-3 mb-10">
                  {preScanData.keywords.map((k: string, i: number) => (
                    <span key={i} className="px-5 py-2 bg-white/20 backdrop-blur-md rounded-2xl text-xs font-bold">#{k}</span>
                  ))}
                </div>
                <div className="bg-black/20 p-6 rounded-2xl flex items-center justify-between border border-white/10">
                  <span className="text-sm font-bold text-violet-100 uppercase tracking-widest">Recommended Analysis Depth</span>
                  <span className="px-6 py-2 bg-white text-violet-900 rounded-xl font-black text-sm uppercase">{preScanData.recommendMode} MODE</span>
                </div>
              </div>
            </div>
          )}

          {/* ⚙️ 설정 섹션 */}
          <div className="max-w-4xl mx-auto space-y-20">
            
            {/* 1. 분석 깊이 */}
            <section>
              <h3 className="font-black text-2xl mb-8 text-gray-900 flex items-center gap-4"><span className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-sm font-black shadow-lg">1</span> 분석 깊이 선택</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {DEPTH_LEVELS.map((mode) => (
                  <button 
                    key={mode.id} 
                    onClick={() => setSelectedMode(mode)}
                    className={`flex flex-col bg-white border-2 p-8 rounded-[3rem] text-left transition-all duration-300 ${
                      selectedMode.id === mode.id ? 'border-violet-600 ring-[12px] ring-violet-50 shadow-2xl' : 'border-gray-100 hover:border-violet-200'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${selectedMode.id === mode.id ? 'bg-violet-600 text-white shadow-lg' : 'bg-gray-50 text-gray-900'}`}>{mode.icon}</div>
                    <h4 className="text-2xl font-black italic mb-2 uppercase tracking-tighter">{mode.label}</h4>
                    <p className="text-xs font-bold text-gray-500 mb-6 leading-relaxed">{mode.desc}</p>
                    <div className="mt-auto bg-gray-50 p-5 rounded-2xl border border-gray-100 mb-6 text-[11px] font-bold text-gray-600">
                      <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest block mb-2">EXPECTED RESULT</span>
                      {mode.output}
                    </div>
                    <div className="font-black text-xs uppercase tracking-widest bg-gray-100 px-4 py-2 rounded-lg self-start">🖋️ {files.length > 1 ? `MULTI ${10 + (files.length * mode.multiInk)}` : mode.ink} INK</div>
                  </button>
                ))}
              </div>
            </section>

            {/* 2. 추가 옵션 */}
            <section>
              <h3 className="font-black text-2xl mb-8 text-gray-900 flex items-center gap-4"><span className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-sm font-black shadow-lg">2</span> 추가 옵션 (Add-ons)</h3>
              <div className="flex flex-col sm:flex-row gap-6">
                <label className={`flex-1 flex items-center gap-5 p-8 rounded-[2.5rem] border-2 cursor-pointer transition-all ${addons.visualization ? 'border-violet-600 bg-violet-50 shadow-lg' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                  <input type="checkbox" className="hidden" checked={addons.visualization} onChange={() => setAddons(p => ({...p, visualization: !p.visualization}))}/>
                  <BarChart3 size={32} className={addons.visualization ? "text-violet-600" : "text-gray-400"} />
                  <div><p className="font-black text-lg text-gray-900 leading-tight">시각화 데이터 추출</p><p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mt-1">+ 5 INK</p></div>
                </label>
                <label className={`flex-1 flex items-center gap-5 p-8 rounded-[2.5rem] border-2 cursor-pointer transition-all ${addons.deepKeyword ? 'border-violet-600 bg-violet-50 shadow-lg' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                  <input type="checkbox" className="hidden" checked={addons.deepKeyword} onChange={() => setAddons(p => ({...p, deepKeyword: !p.deepKeyword}))}/>
                  <Key size={32} className={addons.deepKeyword ? "text-violet-600" : "text-gray-400"} />
                  <div><p className="font-black text-lg text-gray-900 leading-tight">핵심 키워드 집중 분석</p><p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mt-1">+ 5 INK</p></div>
                </label>
              </div>
            </section>

            {/* 3. 출력 스타일 */}
            <section>
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-black text-2xl text-gray-900 flex items-center gap-4"><span className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-sm font-black shadow-lg">3</span> 출력 스타일</h3>
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs font-black text-gray-400 bg-gray-100 px-5 py-2.5 rounded-2xl hover:bg-gray-200 transition-colors uppercase tracking-widest">
                  {showAdvanced ? 'HIDE OPTIONS' : 'SHOW MORE'}
                </button>
              </div>
              {showAdvanced ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 animate-in slide-in-from-top-4">
                  {STYLE_OPTIONS.map(opt => (
                    <button 
                      key={opt.id} onClick={() => setSelectedStyle(opt.id)}
                      className={`p-7 rounded-[2.5rem] border-2 text-left transition-all ${selectedStyle === opt.id ? 'border-violet-600 bg-violet-50 text-violet-700' : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'}`}
                    >
                      <div className="flex items-center gap-2 font-black mb-2 text-sm uppercase tracking-tighter">{opt.icon} {opt.label}</div>
                      <div className="text-[10px] font-bold opacity-80 leading-relaxed">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm font-bold text-gray-500 bg-gray-50 px-8 py-5 rounded-3xl border border-gray-100 flex items-center gap-4 italic">
                  <PenTool size={20} className="text-violet-400"/> Current Output: <span className="text-violet-600 font-black uppercase">Academic (논문형)</span>
                </div>
              )}
            </section>

            {/* 메인 분석 버튼 */}
            <button 
              onClick={handleOpenModal} 
              className="w-full py-9 bg-black text-white rounded-[3rem] font-black text-2xl shadow-2xl shadow-gray-400 hover:bg-violet-600 hover:-translate-y-2 transition-all flex items-center justify-center gap-5 uppercase tracking-tighter"
            >
              RUN COMPREHENSIVE ANALYSIS <ArrowRight size={32} />
            </button>
          </div>

          {/* 📜 최근 연구 노트 섹션 */}
          <div className="max-w-4xl mx-auto mt-32">
            <div className="flex items-center justify-between mb-10 px-6">
              <h3 className="font-black text-3xl text-gray-900 flex items-center gap-4 italic tracking-tighter"><Clock className="text-violet-600" /> Recent Stacks</h3>
              <Link href="/library" className="text-xs font-black text-gray-400 hover:text-violet-600 flex items-center gap-2 uppercase tracking-widest transition-colors">View All <ArrowRight size={16}/></Link>
            </div>
            
            <div className="space-y-5">
              {recentDocs.length > 0 ? recentDocs.map((doc) => (
                <Link key={doc.id} href={`/analysis/${doc.id}`} className="flex items-center justify-between bg-white border-2 border-gray-100 p-8 rounded-[2.5rem] hover:border-violet-300 hover:shadow-2xl hover:-translate-y-1 transition-all group relative overflow-hidden">
                  <div className="flex items-center gap-6 relative z-10">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 group-hover:bg-violet-600 group-hover:text-white transition-all shadow-sm">
                      <FileText size={28} />
                    </div>
                    <div className="flex flex-col">
                      <div className="font-black text-gray-900 text-lg line-clamp-1 group-hover:text-violet-600 transition-colors">
                        {doc.title}
                      </div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                        Analyzed on {doc.createdAt?.toDate().toLocaleDateString('ko-KR')} • {doc.mode}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={24} className="text-gray-200 group-hover:text-violet-600 transition-all group-hover:translate-x-1" />
                  <div className="absolute bottom-0 left-0 h-1 bg-violet-600 w-0 group-hover:w-full transition-all duration-500"></div>
                </Link>
              )) : (
                <div className="text-center py-24 bg-gray-50 rounded-[4rem] border-2 border-dashed border-gray-200 font-black text-gray-400 italic text-xl">
                  아직 쌓인 지식이 없습니다.<br/><span className="text-sm not-italic opacity-60">첫 번째 논문을 분석하여 지식 스택을 시작해보세요.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🧾 분석 청구서 모달 */}
      {confirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md px-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[4rem] p-12 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-3xl font-black text-gray-900 mb-10 flex items-center gap-4 italic underline decoration-violet-500 underline-offset-8 decoration-4">ANALYSIS BILL</h3>
            <div className="bg-gray-50 rounded-[2.5rem] p-10 mb-12 space-y-5 font-bold text-sm">
              <div className="flex justify-between items-center"><span className="text-gray-400 uppercase tracking-widest">Base Computation</span><span className="text-gray-900">🖋️ {confirmModal.baseCost}</span></div>
              {confirmModal.pageSurcharge > 0 && <div className="flex justify-between items-center text-red-500 text-xs font-black uppercase"><span>Large Volume (100P+)</span><span>+ {confirmModal.pageSurcharge}</span></div>}
              {confirmModal.textSurcharge > 0 && <div className="flex justify-between items-center text-red-500 text-xs font-black uppercase"><span>Token Surcharge</span><span>+ {confirmModal.textSurcharge}</span></div>}
              {confirmModal.addonCost > 0 && <div className="flex justify-between items-center text-blue-500 text-xs font-black uppercase"><span>Add-ons</span><span>+ {confirmModal.addonCost}</span></div>}
              <hr className="border-gray-200 my-6" />
              <div className="flex justify-between items-center">
                <span className="text-gray-900 font-black text-xl italic">FINAL INK</span>
                {confirmModal.isFree ? (
                  <span className="text-violet-600 font-black bg-violet-100 px-4 py-1.5 rounded-xl text-xs uppercase tracking-widest animate-pulse">FREE FIRST TRIAL</span>
                ) : (
                  <span className="text-3xl font-black text-violet-600 italic">🖋️ {confirmModal.totalCost}</span>
                )}
              </div>
            </div>
            <div className="flex gap-5">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-6 bg-gray-100 text-gray-500 rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={executeAnalysis} className="flex-[2] py-6 bg-black text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-violet-600 shadow-2xl transition-all">Confirm & Pay</button>
            </div>
          </div>
        </div>
      )}

      {/* 🌀 분석 중 로딩 애니메이션 */}
      {status === 'analyzing' && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in zoom-in-95 duration-700">
          <div className="relative mb-16">
            <div className="w-40 h-40 bg-violet-100 rounded-full animate-ping absolute top-0 left-0 opacity-40" />
            <div className="w-40 h-40 bg-violet-600 rounded-full flex items-center justify-center relative z-10 shadow-[0_0_50px_rgba(139,92,246,0.3)]">
              <Loader2 size={72} className="text-white animate-spin" />
            </div>
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-6 uppercase tracking-tighter italic">Extracting Wisdom...</h2>
          <p className="text-gray-600 font-bold h-8 animate-pulse italic text-lg">{LOADING_MESSAGES[loadingMsgIdx]}</p>
        </div>
      )}
      
      {/* 🎉 성공 화면 */}
      {status === 'success' && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] animate-in zoom-in-95">
          <div className="w-40 h-40 bg-green-500 rounded-full flex items-center justify-center mb-12 shadow-2xl shadow-green-100 animate-bounce">
            <CheckCircle2 size={80} className="text-white" />
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-4 italic uppercase">Success!</h2>
          <p className="text-gray-500 font-bold text-lg uppercase tracking-widest">Stacking your new knowledge...</p>
        </div>
      )}
    </main>
  );
}
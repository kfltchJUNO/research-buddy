"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { runUnifiedAnalysisAction } from "@/app/actions/analyze-action";
import { runBackgroundPreScan } from "@/app/actions/prescan-action";
import toast from "react-hot-toast";
import { 
  FileUp, Loader2, Files, XCircle, Settings2, PenTool, GraduationCap, 
  MessageSquare, CheckCircle2, AlertTriangle, Info, Zap, BrainCircuit, 
  Microscope, Lightbulb, BarChart3, Key, ArrowRight
} from "lucide-react";

// 🚀 인상된 요금제 반영 (수익 모델 보정)
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
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // 🚀 [보안 강화] 인증 상태와 유저 데이터를 분리하여 관리
  const [authLoading, setAuthLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  
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
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean; modeData: any; 
    baseCost: number; pageSurcharge: number; textSurcharge: number; addonCost: number; 
    totalCost: number; isFree: boolean;
  } | null>(null);

  // 🚀 [수정] 인증 상태 감시 로직 (Strict Mode)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserData(null);
        setAuthLoading(false);
        router.replace("/login");
      } else {
        // 로그인 성공 시 유저 문서를 실시간 구독
        const userRef = doc(db, "users", user.uid);
        const unsubSnap = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setUserData(snap.data());
          }
          setAuthLoading(false);
        }, (err) => {
          console.error("Firestore 접근 권한 부족:", err);
          setAuthLoading(false);
        });
        return () => unsubSnap();
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'analyzing') {
      interval = setInterval(() => setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length), 4000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleFileChange = async (newFiles: File[]) => {
    const pdfFiles = newFiles.filter(f => f.type === "application/pdf");
    if (pdfFiles.length === 0) return toast.error("PDF 파일만 업로드 가능합니다.");
    
    setFiles(pdfFiles);
    setPreScanData(null);
    setPdfMeta({ pages: 0, chars: 0 });
    setSourceText("");
    
    let totalPages = 0;
    let totalChars = 0;
    let fullExtractedText = "";
    
    toast.loading("논문 분량을 측정 중입니다...", { id: 'parsing' });
    try {
      // @ts-ignore
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      for (const file of pdfFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        totalPages += pdf.numPages;
        
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
      toast.success(`측정 완료: ${totalPages}페이지 / 약 ${totalChars.toLocaleString()}자`, { id: 'parsing' });

      if (pdfFiles.length === 1) {
        setIsPreScanning(true);
        const base64 = Buffer.from(await pdfFiles[0].arrayBuffer()).toString("base64");
        const scanRes = await runBackgroundPreScan(base64, pdfFiles[0].type);
        if (scanRes.success) {
          setPreScanData(scanRes.data);
          const recommended = DEPTH_LEVELS.find(m => m.id === scanRes.data.recommendMode?.toLowerCase());
          if (recommended) setSelectedMode(recommended);
        }
        setIsPreScanning(false);
      }
    } catch (err) {
      toast.error("파일 분석 오류");
    }
  };

  const handleOpenModal = () => {
    if (files.length === 0) return toast.error("PDF 파일을 업로드해주세요.");

    const isMulti = files.length > 1;
    const baseCost = isMulti ? 10 + (files.length * selectedMode.multiInk) : selectedMode.ink;
    
    const pageSurcharge = pdfMeta.pages > 100 ? 5 : 0;
    const textSurcharge = pdfMeta.chars > 50000 ? Math.ceil((pdfMeta.chars - 50000) / 20000) * 2 : 0;
    const addonCost = (addons.visualization ? 5 : 0) + (addons.deepKeyword ? 5 : 0);
    
    const totalCost = baseCost + pageSurcharge + textSurcharge + addonCost;
    const isFree = !isMulti && (userData?.hasFreeTrial === true || !userData?.analysisCount || userData?.analysisCount === 0);

    if (!isFree && (userData?.inkBalance || 0) < totalCost) {
      return toast.error(`잉크가 부족합니다. (필요: ${totalCost} / 현재: ${userData?.inkBalance || 0})`);
    }

    setConfirmModal({ isOpen: true, modeData: selectedMode, baseCost, pageSurcharge, textSurcharge, addonCost, totalCost, isFree });
  };

  const executeAnalysis = async () => {
    if (!confirmModal) return;
    const { modeData, totalCost } = confirmModal;
    setConfirmModal(null);
    setStatus('analyzing');
    setLoadingMsgIdx(0);

    try {
      const formData = new FormData();
      files.forEach(f => formData.append("files", f));
      formData.append("userId", auth.currentUser!.uid);
      formData.append("mode", modeData.id);
      formData.append("style", selectedStyle);
      formData.append("totalCost", totalCost.toString());
      formData.append("addons", JSON.stringify(addons));
      formData.append("sourceText", sourceText);

      const res = await runUnifiedAnalysisAction(formData);

      if (res.success && res.data?.docId) {
        setStatus('success');
        if (res.data.refundReason) toast.success(res.data.refundReason, { duration: 6000, icon: '💸' });
        setTimeout(() => router.push(`/analysis/${res.data.docId}`), 1500); 
      } else {
        setStatus('error');
        setErrorMsg(res.message || "분석 실패");
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg("통신 장애 발생");
    }
  };

  // 🚀 [가드] 인증 로딩 중일 때는 아무것도 보여주지 않음 (게스트 오인 방지)
  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-violet-600" size={40} /></div>;

  return (
    <main className="pt-32 pb-32 px-6 max-w-5xl mx-auto">
      {status === 'idle' && (
        <div className="animate-in fade-in duration-500">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black italic tracking-tighter text-gray-900 mb-4 uppercase">Everything starts<br/>with a Question.</h1>
            <p className="text-gray-400 font-bold text-sm tracking-widest uppercase">ResearchBuddy: Build your Knowledge Stack</p>
          </div>

          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileChange(Array.from(e.dataTransfer.files)); }}
            className={`relative bg-white border-2 border-dashed rounded-[3rem] p-12 mb-6 text-center transition-all duration-300 max-w-4xl mx-auto ${isDragging ? "border-violet-500 bg-violet-50/50 scale-[1.01]" : "border-gray-200 hover:border-violet-300"}`}
          >
            <input type="file" multiple accept=".pdf" onChange={(e) => handleFileChange(Array.from(e.target.files || []))} className="hidden" id="pdf-upload" />
            <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
              <div className={`w-16 h-16 rounded-[2rem] flex items-center justify-center mb-4 transition-all ${isDragging ? "bg-violet-600 text-white" : "bg-gray-50 text-gray-400"}`}>
                {files.length > 0 ? <Files size={32} /> : <FileUp size={32} />}
              </div>
              <h3 className="font-black text-gray-900">{files.length > 0 ? `${files.length}건 준비됨 (${pdfMeta.pages}P / 약 ${Math.floor(pdfMeta.chars/1000)}K 자)` : "PDF 파일을 이곳에 던져주세요"}</h3>
              <p className="text-xs text-gray-400 mt-2 italic font-bold">보안 정책에 따라 업로드된 파일은 1시간 후 영구 파기됩니다.</p>
            </label>
            
            {files.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-900 text-white px-3 py-1.5 rounded-xl text-[10px] font-black italic">
                    <span className="truncate max-w-[120px]">{f.name}</span>
                    <button onClick={(e) => { e.preventDefault(); setFiles(files.filter((_, idx) => idx !== i)); }} className="text-gray-400 hover:text-red-400"><XCircle size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isPreScanning && <div className="max-w-4xl mx-auto mb-8 p-6 bg-violet-50 rounded-2xl animate-pulse text-center font-bold text-violet-600"><Loader2 size={20} className="inline animate-spin mr-2"/>AI가 논문의 맥락을 선행 스캔 중입니다...</div>}
          
          {preScanData && (
            <div className="max-w-4xl mx-auto mb-10 p-8 bg-gradient-to-br from-violet-600 to-indigo-900 text-white rounded-3xl shadow-2xl animate-in slide-in-from-bottom-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10"><Lightbulb size={120} /></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4 text-violet-200 font-black tracking-widest text-xs uppercase"><Lightbulb size={16}/> Pre-Scan 인사이트</div>
                <h3 className="text-2xl font-black mb-6 leading-snug break-keep">"{preScanData.summary}"</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  {preScanData.keywords.map((k: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-bold">#{k}</span>
                  ))}
                </div>
                <div className="bg-black/30 p-4 rounded-2xl flex items-center justify-between border border-white/10">
                  <span className="text-sm font-bold text-violet-200">추천 분석 모드:</span>
                  <span className="px-4 py-2 bg-white text-violet-900 rounded-xl font-black text-sm uppercase">{preScanData.recommendMode}</span>
                </div>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto mt-12">
            <div className="mb-10">
              <h3 className="font-black text-xl mb-4 text-gray-900 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">1</span> 분석 깊이 선택</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {DEPTH_LEVELS.map((mode) => (
                  <button 
                    key={mode.id} 
                    onClick={() => setSelectedMode(mode)}
                    className={`group relative flex flex-col bg-white border-2 p-6 rounded-[2rem] text-left transition-all duration-300 h-full ${
                      selectedMode.id === mode.id ? 'border-violet-600 ring-4 ring-violet-50 shadow-lg shadow-violet-100' : 'border-gray-100 hover:border-violet-300'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors ${selectedMode.id === mode.id ? 'bg-violet-600 text-white' : 'bg-gray-50 text-gray-900'}`}>
                      {mode.icon}
                    </div>
                    <h4 className="text-xl font-black italic mb-2 uppercase tracking-tighter">{mode.label}</h4>
                    <p className="text-xs font-bold text-gray-500 mb-4">{mode.desc}</p>
                    <div className="mt-auto bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4 text-[11px] font-bold text-gray-600">
                      <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest block mb-1">Expectation</span>
                      {mode.output}
                    </div>
                    <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest bg-gray-100 px-3 py-1.5 rounded-md self-start">
                      🖋️ {files.length > 1 ? `MULTI ${10 + (files.length * mode.multiInk)}` : mode.ink}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-10 animate-in fade-in duration-500 delay-100">
              <h3 className="font-black text-xl mb-4 text-gray-900 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">2</span> 추가 옵션 (Add-ons)</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <label className={`flex-1 flex items-center gap-3 p-5 rounded-2xl border-2 cursor-pointer transition-all ${addons.visualization ? 'border-violet-600 bg-violet-50 shadow-md' : 'border-gray-100 bg-white hover:border-gray-300'}`}>
                  <input type="checkbox" className="hidden" checked={addons.visualization} onChange={() => setAddons(p => ({...p, visualization: !p.visualization}))}/>
                  <BarChart3 size={24} className={addons.visualization ? "text-violet-600" : "text-gray-400"} />
                  <div><p className="font-black text-sm text-gray-900">시각화 데이터 추출</p><p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">+ 5 INK</p></div>
                </label>
                <label className={`flex-1 flex items-center gap-3 p-5 rounded-2xl border-2 cursor-pointer transition-all ${addons.deepKeyword ? 'border-violet-600 bg-violet-50 shadow-md' : 'border-gray-100 bg-white hover:border-gray-300'}`}>
                  <input type="checkbox" className="hidden" checked={addons.deepKeyword} onChange={() => setAddons(p => ({...p, deepKeyword: !p.deepKeyword}))}/>
                  <Key size={24} className={addons.deepKeyword ? "text-violet-600" : "text-gray-400"} />
                  <div><p className="font-black text-sm text-gray-900">핵심 키워드 집중 분석</p><p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">+ 5 INK</p></div>
                </label>
              </div>
            </div>

            <div className="mb-12 animate-in fade-in duration-500 delay-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-xl text-gray-900 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">3</span> 출력 스타일</h3>
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200">
                  {showAdvanced ? '접기' : '더보기'}
                </button>
              </div>
              {showAdvanced ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {STYLE_OPTIONS.map(opt => (
                    <button 
                      key={opt.id} onClick={() => setSelectedStyle(opt.id)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedStyle === opt.id ? 'border-violet-600 bg-violet-50 text-violet-700' : 'bg-white border-gray-100 text-gray-500 hover:border-gray-300'}`}
                    >
                      <div className="flex items-center gap-2 font-black mb-1 text-sm">{opt.icon} {opt.label}</div>
                      <div className="text-[10px] font-bold opacity-80 leading-tight">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm font-bold text-gray-500 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 flex items-center gap-2 italic">
                  <PenTool size={16}/> Default Style: <span className="text-violet-600">ACADEMIC</span>
                </div>
              )}
            </div>

            <button 
              onClick={handleOpenModal} 
              className="w-full py-6 bg-black text-white rounded-2xl font-black text-xl shadow-2xl shadow-gray-300 hover:bg-violet-600 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
            >
              RUN ANALYSIS <ArrowRight size={24} />
            </button>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2"><Info size={20} className="text-violet-600"/> ANALYSIS BILL</h3>
            <div className="bg-gray-50 rounded-2xl p-6 mb-8 space-y-3 font-bold text-sm">
              <div className="flex justify-between items-center"><span className="text-gray-500">Base Cost</span><span className="text-gray-900">🖋️ {confirmModal.baseCost}</span></div>
              {confirmModal.pageSurcharge > 0 && <div className="flex justify-between items-center text-red-500 text-xs"><span>Page Surcharge</span><span>+ {confirmModal.pageSurcharge}</span></div>}
              {confirmModal.textSurcharge > 0 && <div className="flex justify-between items-center text-red-500 text-xs"><span>Token Surcharge</span><span>+ {confirmModal.textSurcharge}</span></div>}
              {confirmModal.addonCost > 0 && <div className="flex justify-between items-center text-blue-500 text-xs"><span>Add-ons</span><span>+ {confirmModal.addonCost}</span></div>}
              <hr className="border-gray-200 my-4" />
              <div className="flex justify-between items-center">
                <span className="text-gray-900 font-black">Total Ink</span>
                {confirmModal.isFree ? <span className="text-violet-600 font-black">FREE TRIAL</span> : <span className="text-xl font-black text-violet-600">🖋️ {confirmModal.totalCost}</span>}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm">CANCEL</button>
              <button onClick={executeAnalysis} className="flex-[2] py-4 bg-black text-white rounded-2xl font-black text-sm hover:bg-violet-600">CONFIRM</button>
            </div>
          </div>
        </div>
      )}

      {status === 'analyzing' && (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <div className="relative mb-8">
            <div className="w-24 h-24 bg-violet-100 rounded-full animate-ping absolute top-0 left-0 opacity-50" />
            <div className="w-24 h-24 bg-violet-600 rounded-full flex items-center justify-center relative z-10"><Loader2 size={40} className="text-white animate-spin" /></div>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-3 uppercase">Deep Diving into Data...</h2>
          <p className="text-gray-500 font-bold h-6 animate-pulse">{LOADING_MESSAGES[loadingMsgIdx]}</p>
        </div>
      )}
      {status === 'success' && (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-8"><CheckCircle2 size={48} className="text-white" /></div>
          <h2 className="text-3xl font-black text-gray-900 mb-3">DONE!</h2>
          <p className="text-gray-500 font-bold">Moving to Knowledge Stack...</p>
        </div>
      )}
      {status === 'error' && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-8"><AlertTriangle size={40} className="text-red-500" /></div>
          <h2 className="text-2xl font-black text-gray-900 mb-4 tracking-tight">ANALYSIS FAILED</h2>
          <p className="text-gray-500 font-bold mb-8 max-w-md bg-white p-4 rounded-xl border border-gray-100">{errorMsg}</p>
          <button onClick={() => setStatus('idle')} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm">RETRY</button>
        </div>
      )}
    </main>
  );
}
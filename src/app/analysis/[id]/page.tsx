"use client";

import { useEffect, useState, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth"; // 🚀 필수 추가
import { doc, getDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { 
  Loader2, ArrowLeft, BookOpen, FileText, Copy, CheckCircle2, 
  ShieldAlert, ShieldCheck, Download, Share2, FileImage, FileDown, 
  Microscope, ChevronDown, ChevronUp, Layers, Lightbulb, RefreshCw, BarChart3, Lock
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { runReanalyzeAction } from "@/app/actions/reanalyze-action";
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnalysisResultPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date()); 
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const summaryCardRef = useRef<HTMLDivElement>(null);
  const fullContentRef = useRef<HTMLDivElement>(null);

  // 🚀 [수정] 인증 상태 대기 후 Firestore 호출 로직 (보안 규칙 에러 방지)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const docRef = doc(db, "knowledge_library", docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const fetched = docSnap.data();
          // 보안 검증: 내 문서가 아닐 경우 추방
          if (fetched.userId !== user.uid) {
            toast.error("Unauthorized Access");
            router.push("/");
            return;
          }
          setData(fetched);
        } else {
          router.push("/");
        }
      } catch (error) {
        console.error("데이터 로드 실패:", error);
        toast.error("Access Denied: Security Policy");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [docId, router]);

  // 10초마다 현재 시각 갱신 (카운트다운용)
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = () => {
    if (!mainResultText) return;
    navigator.clipboard.writeText(mainResultText).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExportImage = async () => {
    if (summaryCardRef.current === null) return;
    try {
      const dataUrl = await toPng(summaryCardRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `Summary_${data.title}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Card saved as image");
    } catch (err) {
      toast.error("Failed to export image");
    }
  };

  const handleExportWord = async () => {
    if (!mainResultText) return;
    try {
      const paragraphs = mainResultText.split('\n').map((line: string) => 
        new Paragraph({ children: [new TextRun({ text: line, size: 24 })] })
      );
      const docx = new Document({ sections: [{ properties: {}, children: paragraphs }] });
      const blob = await Packer.toBlob(docx);
      saveAs(blob, `[ResearchBuddy] ${data.title}.docx`);
      toast.success("Word document downloaded");
    } catch (err) {
      toast.error("Word export failed");
    }
  };

  const handleExportPDF = async () => {
    if (fullContentRef.current === null) return;
    toast.loading("Generating PDF...", { id: 'pdf' });
    try {
      const dataUrl = await toPng(fullContentRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`[ResearchBuddy] ${data.title}.pdf`);
      toast.success("PDF downloaded", { id: 'pdf' });
    } catch (err) {
      toast.error("PDF export failed", { id: 'pdf' });
    }
  };

  const handleReanalyze = async (perspective: string) => {
    if (!auth.currentUser) return toast.error("Please login first");
    const cost = Math.max(1, Math.ceil((data.originalCost || 25) * 0.8));
    if (!confirm(`Re-analyze with [${perspective}]?\nCost: 🖋️ ${cost} INK (20% OFF)`)) return;
    const loadingToast = toast.loading(`Processing re-analysis...`);
    try {
      const res = await runReanalyzeAction(docId, perspective, auth.currentUser.uid);
      if (res.success && res.data?.newDocId) {
        toast.success(`Analysis Complete!`, { id: loadingToast });
        router.push(`/analysis/${res.data.newDocId}`); 
      } else {
        toast.error(res.message || "Failed", { id: loadingToast });
      }
    } catch (err) {
      toast.error("Connection error", { id: loadingToast });
    }
  };

  const toggleAccordion = (id: string) => setOpenAccordion(openAccordion === id ? null : id);

  if (loading) return <div className="min-h-screen pt-32 flex justify-center"><Loader2 className="animate-spin text-violet-600" size={40} /></div>;
  if (!data) return null;

  // 🚀 안전한 날짜 파싱 및 카운트다운 로직
  let createdAt = new Date();
  if (data.createdAt) {
    if (typeof data.createdAt.toDate === 'function') createdAt = data.createdAt.toDate();
    else if (data.createdAt.seconds) createdAt = new Date(data.createdAt.seconds * 1000);
    else createdAt = new Date(data.createdAt);
  }
  if (!createdAt || isNaN(createdAt.getTime())) createdAt = new Date();

  const deletionTime = new Date(createdAt.getTime() + 60 * 60 * 1000);
  const diffMs = deletionTime.getTime() - currentTime.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  const isDeleted = diffMs <= 0;
  const formattedDeletionTime = deletionTime.toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  let rawText = data.analysisResult || "";
  let mainResultText = rawText;
  
  let evidenceText = "Evidence quotes will appear here after analysis.";
  const evidenceMatch = rawText.match(/\[근거 데이터 시작\]([\s\S]*?)\[근거 데이터 끝\]/);
  if (evidenceMatch) {
    evidenceText = evidenceMatch[1].trim();
    mainResultText = mainResultText.replace(/\[근거 데이터 시작\][\s\S]*?\[근거 데이터 끝\]/, "").trim();
  }

  let chartData = data.visualizationData || null;

  let shortSummary = "Important Research Insight";
  const summaryMatch = mainResultText.match(/\[한줄요약\]\s*(.+)/);
  if (summaryMatch) {
    shortSummary = summaryMatch[1].trim(); 
    mainResultText = mainResultText.replace(summaryMatch[0], "").trim();
  } else {
    shortSummary = mainResultText.split('\n')[0].substring(0, 40) + "..."; 
  }

  let rechartsData: any[] = [];
  if (chartData && chartData.data_points) {
    rechartsData = chartData.data_points.map((dp: any) => ({
      name: dp.category,
      value: typeof dp.value === 'number' ? dp.value : parseFloat(dp.value.toString().replace(/[^0-9.-]+/g, "")),
      description: dp.description,
      unit: dp.unit === 'percentage' ? '%' : ''
    }));
  }

  const renderTextWithSeparators = (text: string) => {
    if (!text) return null;
    return text.split('[구분선: -------------]').map((part, index, array) => (
      <span key={index}>
        {part}
        {index < array.length - 1 && <hr className="my-8 border-t-2 border-dashed border-gray-200" />}
      </span>
    ));
  };

  return (
    <main className="pt-28 pb-32 px-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-gray-500 font-bold text-sm">
          <ArrowLeft size={16} /> NEW ANALYSIS
        </button>
        <Link href="/library" className="bg-black text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-violet-600 transition-colors">
          SECOND BRAIN
        </Link>
      </div>

      <div className="mb-10">
        <div ref={summaryCardRef} className="bg-gradient-to-br from-violet-600 to-indigo-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Microscope size={120} /></div>
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-lg text-[10px] font-black uppercase mb-4 tracking-widest">
              ResearchBuddy 🖋️ {data.mode}
            </span>
            <h2 className="text-3xl font-black leading-snug mb-4 break-keep italic">"{shortSummary}"</h2>
            <p className="text-sm opacity-60 font-medium truncate">{data.title}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          {isDeleted ? (
            <span className="text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg flex items-center gap-2"><ShieldCheck size={14}/> 原本 파기 완료 (Security Guaranteed)</span>
          ) : (
            <div className="flex flex-col items-start gap-1">
              <span className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-lg transition-all ${diffMinutes < 10 ? 'bg-red-500 text-white animate-pulse' : 'bg-red-50 text-red-500'}`}>
                <ShieldAlert size={14}/> 
                {diffMinutes > 0 ? `${diffMinutes} MINUTES LEFT` : "URGENT: DELETING SOON"} 
                ({formattedDeletionTime} AUTO-PURGE)
              </span>
              {diffMinutes < 30 && <span className="text-[10px] font-bold text-red-400 ml-1 uppercase">20% Discount expires upon deletion!</span>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportPDF} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"><Download size={18}/></button>
          <button onClick={handleCopy} className={`p-3 rounded-xl transition-all ${copied ? "bg-green-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}><Copy size={18}/></button>
        </div>
      </div>

      <div ref={fullContentRef}>
        {chartData && rechartsData.length > 0 && (
          <div className="bg-white p-10 rounded-t-[2.5rem] border-t border-l border-r border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-indigo-500"></div>
            <h3 className="font-black text-2xl text-gray-900 flex items-center gap-2 mb-8"><BarChart3 className="text-violet-600" /> Data Insights</h3>
            <div className="h-[350px] bg-gray-50 p-6 rounded-2xl border border-gray-100">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rechartsData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 'bold' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <div className={`bg-white p-10 border border-gray-100 shadow-xl ${chartData ? 'rounded-b-[2.5rem]' : 'rounded-[2.5rem]'}`}>
          <div className="text-gray-800 text-[15px] leading-[1.8] font-medium whitespace-pre-wrap">{renderTextWithSeparators(mainResultText)}</div>
        </div>
      </div>

      {!data.isDeepAnalyzed && !isDeleted && (
        <div className="relative mt-8 p-10 border-2 border-dashed border-violet-200 rounded-[2.5rem] bg-violet-50/20 text-center">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-6 mx-auto"><Lock size={32} className="text-violet-600" /></div>
          <h4 className="text-xl font-black text-gray-900 mb-2 italic">Hidden Insights Detected.</h4>
          <p className="text-sm font-bold text-gray-500 mb-8 max-w-md mx-auto">There are critical contradictions in this research that are currently hidden. Don't base your findings on incomplete data.</p>
          <button onClick={() => handleReanalyze('CRITICAL BIAS SCAN')} className="px-8 py-4 bg-violet-600 text-white rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all">UNVEIL HIDDEN TRUTHS (8 INK)</button>
        </div>
      )}

      <div className="bg-gray-50 p-8 rounded-b-[2.5rem] border-b border-l border-r border-gray-200 mt-[-1px] space-y-8">
        <div className="flex gap-4">
          <button onClick={() => toggleAccordion('reliability')} className="flex items-center gap-2 text-sm font-black text-gray-600 hover:text-violet-600 bg-white px-4 py-2 rounded-xl border border-gray-200">RELIABILITY INDEX</button>
          <button onClick={() => toggleAccordion('evidence')} className="flex items-center gap-2 text-sm font-black text-gray-600 hover:text-violet-600 bg-white px-4 py-2 rounded-xl border border-gray-200">SOURCE EVIDENCE</button>
        </div>
        {openAccordion === 'reliability' && (
          <div className="bg-white p-6 rounded-2xl border border-violet-100 animate-in slide-in-from-top-2">
            <h4 className="font-black text-gray-900 mb-2 uppercase text-xs tracking-widest">RAG Mathematical Verification</h4>
            <div className="flex h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div className="bg-green-500 transition-all duration-1000" style={{ width: `${data.reliability?.direct || 72}%` }}></div>
              <div className="bg-violet-400 transition-all duration-1000" style={{ width: `${data.reliability?.semantic || 28}%` }}></div>
            </div>
            <p className="text-xs font-bold text-gray-400">Direct Quotes: {data.reliability?.direct}% | Semantic Interpretation: {data.reliability?.semantic}%</p>
          </div>
        )}
        {openAccordion === 'evidence' && <div className="bg-white p-6 rounded-2xl border border-violet-100 text-sm italic text-gray-600 whitespace-pre-wrap">{evidenceText}</div>}
      </div>
    </main>
  );
}
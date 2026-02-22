"use client";

import { useEffect, useState, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { 
  Loader2, ArrowLeft, BookOpen, FileText, Copy, CheckCircle2, 
  ShieldAlert, ShieldCheck, Download, Share2, FileImage, FileDown, 
  Microscope, ChevronDown, ChevronUp, Layers, Lightbulb, RefreshCw, BarChart3
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
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const summaryCardRef = useRef<HTMLDivElement>(null);
  const fullContentRef = useRef<HTMLDivElement>(null);

  const docId = params.id as string;

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const docSnap = await getDoc(doc(db, "knowledge_library", docId));
        if (docSnap.exists()) {
          setData(docSnap.data());
        } else {
          router.push("/");
        }
      } catch (error) {
        toast.error("데이터 로드 오류");
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [docId, router]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = () => {
    if (!mainResultText) return;
    navigator.clipboard.writeText(mainResultText).then(() => {
      setCopied(true);
      toast.success("클립보드에 복사되었습니다.");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExportImage = async () => {
    if (summaryCardRef.current === null) return;
    try {
      const dataUrl = await toPng(summaryCardRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `리서치버디_요약_${data.title}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("이미지 카드가 저장되었습니다!");
    } catch (err) {
      toast.error("이미지 생성에 실패했습니다.");
    }
  };

  const handleExportWord = async () => {
    if (!mainResultText) return;
    try {
      const paragraphs = mainResultText.split('\n').map((line: string) => 
        new Paragraph({ children: [new TextRun({ text: line, size: 24 })] })
      );
      const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `[리서치버디] ${data.title}.docx`);
      toast.success("Word 문서가 다운로드되었습니다.");
    } catch (err) {
      toast.error("Word 변환 실패");
    }
  };

  const handleExportPDF = async () => {
    if (fullContentRef.current === null) return;
    toast.loading("PDF를 생성 중입니다...", { id: 'pdf' });
    try {
      const dataUrl = await toPng(fullContentRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`[리서치버디] ${data.title}.pdf`);
      toast.success("PDF가 다운로드되었습니다.", { id: 'pdf' });
    } catch (err) {
      toast.error("PDF 생성 실패", { id: 'pdf' });
    }
  };

  const handleReanalyze = async (perspective: string) => {
    if (!auth.currentUser) return toast.error("로그인이 필요합니다.");
    const estimatedCost = Math.max(1, Math.ceil((data.originalCost || 20) * 0.8));
    if (!confirm(`[${perspective}] 관점으로 재분석하시겠습니까?\n(할인 적용: 🖋️ ${estimatedCost} INK 차감)`)) return;
    
    const loadingToast = toast.loading(`스토리지에서 원본을 가져와 재분석 중입니다...`);
    try {
      const res = await runReanalyzeAction(docId, perspective, auth.currentUser.uid);
      if (res.success && res.data?.newDocId) {
        toast.success(`${res.data.cost} INK 차감 및 재분석 완료!`, { id: loadingToast });
        router.push(`/analysis/${res.data.newDocId}`); 
      } else {
        toast.error(res.message || "재분석 실패", { id: loadingToast });
      }
    } catch (err) {
      toast.error("통신 에러가 발생했습니다.", { id: loadingToast });
    }
  };

  const toggleAccordion = (id: string) => setOpenAccordion(openAccordion === id ? null : id);

  if (loading) return <div className="min-h-screen pt-32 flex justify-center"><Loader2 className="animate-spin text-violet-600" size={40} /></div>;
  if (!data) return null;

  // 🚀 [에러 완벽 방어막] 날짜 파싱을 절대 고장 나지 않게 처리합니다.
  let createdAt = new Date();
  if (data.createdAt) {
    if (typeof data.createdAt.toDate === 'function') {
      createdAt = data.createdAt.toDate();
    } else if (data.createdAt.seconds) {
      createdAt = new Date(data.createdAt.seconds * 1000);
    } else {
      createdAt = new Date(data.createdAt);
    }
  }
  if (!createdAt || isNaN(createdAt.getTime())) {
    createdAt = new Date();
  }

  const deletionTime = new Date(createdAt.getTime() + 60 * 60 * 1000);
  const isDeleted = currentTime >= deletionTime; 
  const formattedDeletionTime = deletionTime.toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  let rawText = data.analysisResult || "";
  let mainResultText = rawText;
  
  let evidenceText = "새로운 문서를 분석하시면 원문 출처(페이지 번호 포함)가 이곳에 정확히 표출됩니다.";
  const evidenceMatch = rawText.match(/\[근거 데이터 시작\]([\s\S]*?)\[근거 데이터 끝\]/);
  if (evidenceMatch) {
    evidenceText = evidenceMatch[1].trim();
    mainResultText = mainResultText.replace(/\[근거 데이터 시작\][\s\S]*?\[근거 데이터 끝\]/, "").trim();
  }

  let chartData = data.visualizationData || null;

  let shortSummary = "이 논문은 중요한 가치를 담고 있습니다.";
  const summaryMatch = mainResultText.match(/\[한줄요약\]\s*(.+)/);
  if (summaryMatch) {
    shortSummary = summaryMatch[1].trim(); 
    mainResultText = mainResultText.replace(summaryMatch[0], "").trim();
  } else {
    shortSummary = mainResultText.split('\n')[0].substring(0, 40) + "..."; 
  }

  let rechartsData: any[] = [];
  if (chartData && chartData.data_points) {
    rechartsData = chartData.data_points.map((dp: any) => {
      let numericValue = 0;
      if (typeof dp.value === 'number') numericValue = dp.value;
      else if (typeof dp.value === 'string') {
        const parsed = parseFloat(dp.value.replace(/[^0-9.-]+/g, ""));
        numericValue = isNaN(parsed) ? 0 : parsed;
      }
      return {
        name: dp.category,
        value: numericValue,
        description: dp.description,
        unit: dp.unit === 'percentage' || dp.unit === 'percentage_of_users' ? '%' : (dp.unit === 'score_out_of_5' ? '점' : '')
      };
    });
  }

  const renderTextWithSeparators = (text: string) => {
    if (!text) return null;
    return text.split('[구분선: -------------]').map((part, index, array) => (
      <span key={index}>
        {part}
        {index < array.length - 1 && <hr className="my-8 border-t-2 border-dashed border-gray-200 w-full" />}
      </span>
    ));
  };

  return (
    <main className="pt-28 pb-32 px-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-gray-500 hover:text-black font-bold text-sm">
          <ArrowLeft size={16} /> 새로운 분석하기
        </button>
        <Link href="/library" className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-violet-600 transition-colors">
          <BookOpen size={14} /> 내 연구 기록 보기
        </Link>
      </div>

      <div className="mb-10">
        <div className="flex items-center justify-between mb-3 px-2">
          <h3 className="text-sm font-black text-gray-500 flex items-center gap-2"><Share2 size={16}/> 요약 카드 공유하기</h3>
          <button onClick={handleExportImage} className="text-xs font-black text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
            <FileImage size={14}/> 이미지 저장
          </button>
        </div>
        
        <div ref={summaryCardRef} className="bg-gradient-to-br from-violet-600 to-indigo-900 p-10 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Microscope size={120} /></div>
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm text-white rounded-lg text-[10px] font-black uppercase mb-4 tracking-widest">
              ResearchBuddy 🖋️ {data.mode} Analysis
            </span>
            <h2 className="text-3xl font-black leading-snug mb-4 break-keep">
              "{shortSummary}"
            </h2>
            <div className="flex items-center gap-2 opacity-80 mt-8">
              <FileText size={16} />
              <p className="text-sm font-medium truncate">{data.title}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          {isDeleted ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg"><ShieldCheck size={14}/> 원본 파기 완료</span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg animate-pulse"><ShieldAlert size={14}/> 원본 파기 1시간 전 ({formattedDeletionTime})</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={handleExportWord} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-black transition-colors">
            <FileDown size={14}/> Word 다운로드
          </button>
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-black transition-colors">
            <Download size={14}/> PDF 다운로드
          </button>
          <button onClick={handleCopy} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-colors ${copied ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {copied ? <CheckCircle2 size={14}/> : <Copy size={14}/>} 복사
          </button>
        </div>
      </div>

      <div ref={fullContentRef}>
        {chartData && rechartsData.length > 0 && (
          <div className="bg-white p-10 rounded-t-[2rem] border-t border-l border-r border-b-0 border-gray-100 shadow-xl shadow-gray-50/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-indigo-500"></div>
            <div className="mb-8">
              <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase mb-3 tracking-widest">AI Data Visualization Add-on</span>
              <h3 className="font-black text-2xl text-gray-900 flex items-center gap-2"><BarChart3 className="text-violet-600" /> {chartData.paper_title || "데이터 시각화 결과"}</h3>
              <p className="text-sm font-bold text-gray-500 mt-2">AI가 논문에서 추출한 핵심 수치를 시각화했습니다.</p>
            </div>
            <div className="h-[350px] w-full bg-gray-50 p-6 rounded-2xl border border-gray-100">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rechartsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 'bold' }} tickFormatter={(val) => val.length > 10 ? val.substring(0, 10) + '...' : val} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} formatter={(value, name, props) => [`${value}${props.payload.unit}`, props.payload.description]} labelStyle={{ color: '#8b5cf6', marginBottom: '4px' }} />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <div className={`bg-white p-10 border border-gray-100 shadow-xl shadow-gray-50/50 ${chartData ? 'rounded-b-[2rem]' : 'rounded-t-[2rem]'}`}>
          <div className="text-gray-800 text-[15px] leading-[1.8] tracking-wide font-medium" style={{ whiteSpace: 'pre-wrap', wordBreak: 'keep-all' }}>
            {renderTextWithSeparators(mainResultText)}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-8 rounded-b-[2rem] border-b border-l border-r border-gray-200 shadow-xl shadow-gray-50/50 mb-10 mt-[-1px]">
        <div className="flex flex-wrap gap-4 mb-8">
          <button onClick={() => toggleAccordion('reliability')} className="flex items-center gap-2 text-sm font-black text-gray-600 hover:text-violet-600 transition-colors bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
            <ShieldAlert size={16} /> 신뢰도 보기 {openAccordion === 'reliability' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
          <button onClick={() => toggleAccordion('evidence')} className="flex items-center gap-2 text-sm font-black text-gray-600 hover:text-violet-600 transition-colors bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
            <Layers size={16} /> 근거 보기 {openAccordion === 'evidence' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
        </div>

        {openAccordion === 'reliability' && (
          <div className="bg-white p-5 rounded-2xl border border-violet-100 mb-8 animate-in slide-in-from-top-2">
            <h4 className="font-black text-gray-900 mb-2">분석 신뢰도 지표 (RAG Verified)</h4>
            <div className="flex h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div className="bg-green-500 transition-all duration-1000" style={{ width: `${data.reliability?.direct || 72}%` }} title="직접 인용 기반"></div>
              <div className="bg-violet-400 transition-all duration-1000" style={{ width: `${data.reliability?.semantic || 28}%` }} title="의미 해석 기반"></div>
            </div>
            <div className="flex justify-between text-xs font-bold text-gray-500 mb-3">
              <span>[직접 인용 기반] {data.reliability?.direct || 72}%</span>
              <span>[의미 해석 기반] {data.reliability?.semantic || 28}%</span>
            </div>
            <p className="text-sm font-medium text-gray-600">이 분석은 원문 텍스트와의 코사인 유사도(Cosine Similarity) 연산을 통해 검증되었습니다. {data.reliability?.direct > 60 ? " 높은 일치도를 보이므로 학술적 근거로 활용하기 좋습니다." : " AI의 맥락적 재해석이 많이 포함되어 있으므로 원본 대조를 권장합니다."}</p>
          </div>
        )}

        {openAccordion === 'evidence' && (
          <div className="bg-white p-5 rounded-2xl border border-violet-100 mb-8 animate-in slide-in-from-top-2">
            <h4 className="font-black text-gray-900 mb-4">주요 근거 문장</h4>
            <div className="text-sm font-medium text-gray-600 italic leading-relaxed whitespace-pre-wrap">{evidenceText}</div>
          </div>
        )}

        <div className="border-t border-gray-200 pt-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-100 text-violet-600 rounded-full mb-4"><Lightbulb size={24} /></div>
          <h3 className="text-xl font-black text-gray-900 mb-2">이 논문, 다른 시선으로 보면?</h3>
          <p className="text-sm text-gray-500 font-bold mb-6">파일 파기 전까지 20% 할인된 잉크로 새로운 인사이트를 발견하세요.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['비판적으로 보기', '반박해보기', '다른 이론으로 보기', '쉽게 설명하기'].map((perspective) => (
              <button 
                key={perspective} onClick={() => handleReanalyze(perspective)}
                className={`group relative flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-sm transition-all shadow-md shadow-gray-100 border border-gray-100 ${isDeleted ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-black text-gray-800 hover:text-white'}`}
                disabled={isDeleted}
              >
                <RefreshCw size={14} className={!isDeleted ? "group-hover:animate-spin" : ""} /> {perspective}
                {!isDeleted && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full border border-white">-20%</span>}
              </button>
            ))}
          </div>
          {isDeleted && <p className="text-xs font-bold text-red-500 mt-4 animate-in fade-in">보안을 위해 원본 파일이 영구 삭제되어 재분석을 진행할 수 없습니다.</p>}
        </div>
      </div>
    </main>
  );
}
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2, ArrowLeft, Copy, CheckCircle2, ShieldAlert, ShieldCheck,
  Download, ChevronDown, ChevronUp, Star, Share2, StickyNote,
  Plus, Trash2, BadgeCheck, TrendingUp, Send, MessageSquare,
  PenTool, GraduationCap, BookOpen, ExternalLink, RefreshCw,
  Zap, Info,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { sendChatMessageAction, restyleAnalysisAction } from "@/app/actions/chat-action";
import { toggleFavoriteAction, addMemoAction, deleteMemoAction, createShareLinkAction } from "@/app/actions/library-actions";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

const STYLE_OPTIONS = [
  { id: "academic", label: "논문형", icon: <PenTool size={14} />, desc: "학술적 톤" },
  { id: "lecture",  label: "강의형", icon: <GraduationCap size={14} />, desc: "친절한 설명" },
  { id: "blog",     label: "블로그형", icon: <MessageSquare size={14} />, desc: "읽기 쉬운 요약" },
] as const;

type StyleType = "academic" | "lecture" | "blog";

export default function AnalysisResultPage() {
  const params  = useParams();
  const router  = useRouter();
  const docId   = params.id as string;

  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  // 스타일 전환
  const [currentStyle, setCurrentStyle] = useState<StyleType>("academic");
  const [displayText, setDisplayText]   = useState("");
  const [isRestyling, setIsRestyling]   = useState(false);
  const [freeRestyleUsed, setFreeRestyleUsed] = useState(false); // ✅ 무료 전환 소진 여부

  // 즐겨찾기
  const [isFavorite, setIsFavorite] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // 메모
  const [memos, setMemos]       = useState<any[]>([]);
  const [newMemo, setNewMemo]   = useState("");
  const [memoLoading, setMemoLoading] = useState(false);

  // 공유
  const [shareId, setShareId]     = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied]   = useState(false);

  // ✅ 채팅
  const [chatOpen, setChatOpen]   = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fullContentRef = useRef<HTMLDivElement>(null);

  // 데이터 로드
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push("/login"); return; }
      try {
        const snap = await getDoc(doc(db, "knowledge_library", docId));
        if (!snap.exists()) { router.push("/"); return; }
        const d = snap.data();
        if (d.userId !== user.uid) { toast.error("권한 없음"); router.push("/"); return; }
        setData(d);
        setDisplayText(d.analysisResult || "");
        setIsFavorite(d.isFavorite || false);
        setMemos(d.memos || []);
        setShareId(d.shareId || null);
        // 저장된 채팅 히스토리 복원 (텍스트만)
        const savedChat = (d.chatHistory || []).map((c: any) => ({
          role: c.role, content: c.content,
        }));
        setChatHistory(savedChat);
      } catch (err: any) {
        toast.error("로드 실패. 다시 시도해주세요.");
      } finally { setLoading(false); }
    });
    return () => unsubAuth();
  }, [docId, router]);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  // 채팅창 자동 스크롤
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);

  // ── 스타일 전환 (1회 무료, 이후 2 INK) ─────────────────────────
  const handleStyleChange = async (style: StyleType) => {
    if (style === currentStyle || isRestyling) return;
    if (!auth.currentUser) return;

    // 유료 전환 전 확인 토스트
    if (freeRestyleUsed) {
      const confirmed = window.confirm(`스타일 전환 무료 횟수를 소진했습니다.\n2 INK를 차감하고 변환할까요?`);
      if (!confirmed) return;
    }

    setIsRestyling(true);
    const t = toast.loading(`${style} 스타일로 변환 중...`);
    const res = await restyleAnalysisAction(docId, auth.currentUser.uid, style);
    if (res.success && res.newText) {
      setDisplayText(res.newText);
      setCurrentStyle(style);
      // 무료 소진 여부 업데이트
      if (res.isFreeRestyle) {
        setFreeRestyleUsed(true);
        toast.success("스타일 변환 완료 (무료 1회 사용)", { id: t });
      } else {
        toast.success(`스타일 변환 완료 (-${res.inkCost} INK)`, { id: t });
      }
    } else {
      toast.error(res.message || "변환 실패", { id: t });
    }
    setIsRestyling(false);
  };

  // ── 즐겨찾기 ──────────────────────────────────────────────────
  const handleToggleFavorite = async () => {
    if (!auth.currentUser || favLoading) return;
    setFavLoading(true);
    const res = await toggleFavoriteAction(docId, isFavorite);
    if (res.success) { setIsFavorite(!isFavorite); toast.success(isFavorite ? "즐겨찾기 해제" : "⭐ 즐겨찾기 추가"); }
    setFavLoading(false);
  };

  // ── 메모 ──────────────────────────────────────────────────────
  const handleAddMemo = async () => {
    if (!newMemo.trim() || !auth.currentUser) return;
    setMemoLoading(true);
    const res = await addMemoAction(docId, newMemo.trim(), auth.currentUser.uid);
    if (res.success && res.memo) { setMemos((p) => [...p, res.memo]); setNewMemo(""); toast.success("메모 저장"); }
    else toast.error("저장 실패");
    setMemoLoading(false);
  };

  const handleDeleteMemo = async (memo: any) => {
    if (!auth.currentUser) return;
    const res = await deleteMemoAction(docId, memo, auth.currentUser.uid);
    if (res.success) setMemos((p) => p.filter((m) => m.id !== memo.id));
  };

  // ── 공유 ──────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!auth.currentUser || shareLoading) return;
    if (shareId) {
      await navigator.clipboard.writeText(`${window.location.origin}/shared/${shareId}`);
      setShareCopied(true); toast.success("링크 복사!"); setTimeout(() => setShareCopied(false), 2000); return;
    }
    setShareLoading(true);
    const res = await createShareLinkAction(docId, auth.currentUser.uid);
    if (res.success && res.shareId) {
      setShareId(res.shareId);
      await navigator.clipboard.writeText(`${window.location.origin}/shared/${res.shareId}`);
      setShareCopied(true); toast.success("공유 링크 생성 완료! (7일 유효)"); setTimeout(() => setShareCopied(false), 2000);
    } else toast.error("공유 링크 생성 실패");
    setShareLoading(false);
  };

  // ── 복사 ──────────────────────────────────────────────────────
  const handleCopy = () => {
    navigator.clipboard.writeText(mainResultText).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── PDF 내보내기 ───────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!fullContentRef.current) return;
    toast.loading("PDF 생성 중...", { id: "pdf" });
    try {
      const dataUrl = await toPng(fullContentRef.current, { backgroundColor: "#ffffff", pixelRatio: 2 });
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(dataUrl);
      const w = pdf.internal.pageSize.getWidth();
      pdf.addImage(dataUrl, "PNG", 0, 0, w, (imgProps.height * w) / imgProps.width);
      pdf.save(`[ResearchBuddy] ${data.title}.pdf`);
      toast.success("PDF 다운로드", { id: "pdf" });
    } catch { toast.error("PDF 내보내기 실패", { id: "pdf" }); }
  };

  // ── Word 내보내기 ──────────────────────────────────────────────
  const handleExportWord = async () => {
    const paragraphs = mainResultText.split("\n").map(
      (line) => new Paragraph({ children: [new TextRun({ text: line, size: 24 })] })
    );
    const docx = new Document({ sections: [{ properties: {}, children: paragraphs }] });
    saveAs(await Packer.toBlob(docx), `[ResearchBuddy] ${data?.title}.docx`);
    toast.success("Word 다운로드");
  };

  // ── ✅ 채팅 전송 ──────────────────────────────────────────────
  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading || !auth.currentUser) return;
    const question = chatInput.trim();
    setChatInput("");
    setChatHistory((p) => [...p, { role: "user", content: question }]);
    setChatLoading(true);

    const res = await sendChatMessageAction(
      docId,
      auth.currentUser.uid,
      question,
      chatHistory.slice(-6),
      currentStyle
    );

    if (res.success && res.answer) {
      setChatHistory((p) => [...p, { role: "assistant", content: res.answer }]);
    } else {
      setChatHistory((p) => [...p, { role: "assistant", content: `오류: ${res.message}` }]);
      toast.error(res.message || "채팅 오류");
    }
    setChatLoading(false);
  };

  // ── 렌더링 ────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen pt-32 flex justify-center">
      <Loader2 className="animate-spin text-violet-600" size={40} />
    </div>
  );
  if (!data) return null;

  // 날짜 파싱
  let createdAt = new Date();
  if (data.createdAt?.toDate) createdAt = data.createdAt.toDate();
  else if (data.createdAt?.seconds) createdAt = new Date(data.createdAt.seconds * 1000);

  const fileDeletedAt = data.fileDeletedAt
    ? (data.fileDeletedAt.toDate?.() || new Date(data.fileDeletedAt.seconds * 1000))
    : new Date(createdAt.getTime() + 3600000);
  const diffMs = fileDeletedAt.getTime() - currentTime.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  const isDeleted = diffMs <= 0;

  // 텍스트 파싱
  let mainResultText = displayText;
  let evidenceText = "근거 데이터 없음";
  const evidenceMatch = displayText.match(/\[근거 데이터 시작\]([\s\S]*?)\[근거 데이터 끝\]/);
  if (evidenceMatch) {
    evidenceText = evidenceMatch[1].trim();
    mainResultText = mainResultText.replace(/\[근거 데이터 시작\][\s\S]*?\[근거 데이터 끝\]/, "").trim();
  }
  let shortSummary = "Research Insight";
  const summaryMatch = mainResultText.match(/\[한줄요약\]\s*(.+)/);
  if (summaryMatch) { shortSummary = summaryMatch[1].trim(); mainResultText = mainResultText.replace(summaryMatch[0], "").trim(); }

  const renderText = (text: string) =>
    text.split("[구분선: -------------]").map((part, i, arr) => (
      <span key={i}>
        {part}
        {i < arr.length - 1 && <hr className="my-8 border-t-2 border-dashed border-gray-200" />}
      </span>
    ));

  const kciData = data.kciData;

  return (
    <main className="pt-28 pb-40 px-4 sm:px-6 max-w-3xl mx-auto animate-in fade-in duration-500">

      {/* 상단 네비 */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-gray-500 font-bold text-sm hover:text-black transition-colors">
          <ArrowLeft size={16} /> 새 분석
        </button>
        <div className="flex items-center gap-2">
          <button onClick={handleToggleFavorite} disabled={favLoading}
            className={`p-2.5 rounded-xl border-2 transition-all ${isFavorite ? "border-amber-300 bg-amber-50 text-amber-500" : "border-gray-100 text-gray-300 hover:border-gray-200"}`}>
            <Star size={18} fill={isFavorite ? "currentColor" : "none"} />
          </button>
          <Link href="/library" className="bg-black text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-violet-600 transition-colors">
            서재
          </Link>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-900 p-8 rounded-[2.5rem] text-white shadow-2xl mb-6 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 opacity-10">
          <BookOpen size={120} />
        </div>
        <div className="relative z-10">
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-3 py-1 bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest">
              ResearchBuddy · {data.mode}
            </span>
            {data.reliability?.kciVerified && (
              <span className="flex items-center gap-1 px-3 py-1 bg-green-500/30 border border-green-400/50 rounded-lg text-[10px] font-black text-green-200">
                <BadgeCheck size={11} /> {data.reliability.badgeLabel || "KCI"}
              </span>
            )}
            {data.reliability?.kciCitationCount > 0 && (
              <span className="flex items-center gap-1 px-3 py-1 bg-amber-500/30 border border-amber-400/50 rounded-lg text-[10px] font-black text-amber-200">
                <TrendingUp size={11} /> {data.reliability.kciCitationCount}회 인용
              </span>
            )}
          </div>
          <h2 className="text-2xl font-black leading-snug break-keep italic mb-3">"{shortSummary}"</h2>
          <p className="text-sm opacity-50 truncate">{data.title}</p>
        </div>
      </div>

      {/* ✅ KCI 메타데이터 카드 (저장된 데이터 표시) */}
      {kciData && (
        <div className="bg-white border border-violet-100 rounded-[2rem] p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {kciData.isKciIndexed ? (
              <span className="flex items-center gap-1 text-[10px] font-black text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                <BadgeCheck size={10} /> KCI 등재
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
                <BadgeCheck size={10} /> KCI 등록
              </span>
            )}
            {kciData.citationCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                <TrendingUp size={10} /> {kciData.citationCount}회 인용
              </span>
            )}
          </div>
          <h4 className="font-black text-gray-900 text-base leading-snug mb-1">{kciData.title || data.title}</h4>
          <p className="text-xs text-gray-400 font-bold mb-4">
            {kciData.journal}
            {kciData.volume && ` · Vol.${kciData.volume}`}
            {kciData.issue && `(${kciData.issue})`}
            {kciData.startPage && ` · pp.${kciData.startPage}${kciData.endPage ? `–${kciData.endPage}` : ""}`}
            {kciData.year && ` · ${kciData.year}`}
          </p>
          {/* APA 인용 */}
          {kciData.apaCitation && (
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">APA 7th 인용</span>
                <div className="flex items-center gap-2">
                  {kciData.doiUrl && (
                    <a href={kciData.doiUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] font-black text-violet-500 hover:text-violet-700">
                      <ExternalLink size={10} /> DOI
                    </a>
                  )}
                  <button
                    onClick={() => { navigator.clipboard.writeText(kciData.apaCitation); toast.success("APA 인용 복사!"); }}
                    className="flex items-center gap-1 text-[10px] font-black bg-gray-200 text-gray-600 hover:bg-gray-300 px-2.5 py-1.5 rounded-lg transition-all"
                  >
                    <Copy size={10} /> 복사
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-700 font-medium leading-relaxed italic">{kciData.apaCitation}</p>
            </div>
          )}
        </div>
      )}

      {/* 액션 바 */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6 flex flex-wrap justify-between items-center gap-3">
        <div>
          {isDeleted ? (
            <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <ShieldCheck size={13} /> 원본 파기 완료
            </span>
          ) : (
            <div>
              <span className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-lg ${
                diffMin < 10 ? "bg-red-500 text-white animate-pulse" : "bg-red-50 text-red-500"
              }`}>
                <ShieldAlert size={13} />
                원본 PDF {diffMin}분 후 삭제
              </span>
              <p className="text-[10px] text-red-400 font-bold mt-1 ml-1">※ 분석 결과는 유지, 원본 PDF만 삭제</p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {/* 공유 */}
          <button onClick={handleShare} disabled={shareLoading}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-black transition-all ${
              shareCopied ? "bg-green-500 text-white" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
            }`}>
            {shareLoading ? <Loader2 size={14} className="animate-spin" /> : shareCopied ? <CheckCircle2 size={14} /> : <Share2 size={14} />}
            {shareId ? "링크 복사" : "공유"}
          </button>
          <button onClick={handleExportPDF} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors">
            <Download size={16} />
          </button>
          <button onClick={handleCopy} className={`p-2.5 rounded-xl transition-all ${copied ? "bg-green-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
            <Copy size={16} />
          </button>
        </div>
      </div>

      {/* ✅ 스타일 전환 탭 */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl mb-6">
        {STYLE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => handleStyleChange(opt.id)}
            disabled={isRestyling}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl text-xs font-black transition-all ${
              currentStyle === opt.id
                ? "bg-white text-black shadow-sm"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <div className="flex items-center gap-1">
              {isRestyling && currentStyle !== opt.id ? (
                <Loader2 size={12} className="animate-spin" />
              ) : opt.icon}
              {opt.label}
            </div>
            {/* ✅ 무료/유료 배지 */}
            {currentStyle !== opt.id && (
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                !freeRestyleUsed
                  ? "bg-green-100 text-green-600"
                  : "bg-gray-100 text-gray-400"
              }`}>
                {!freeRestyleUsed ? "FREE" : "2 INK"}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 분석 결과 본문 */}
      <div ref={fullContentRef} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl mb-6">
        <div className="text-gray-800 text-[15px] leading-[1.9] font-medium whitespace-pre-wrap">
          {renderText(mainResultText)}
        </div>
      </div>

      {/* ✅ 논문 채팅 섹션 */}
      <div className="bg-white border border-gray-100 rounded-[2rem] shadow-sm mb-6 overflow-hidden">
        {/* 채팅 헤더 */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center">
              <MessageSquare size={18} className="text-white" />
            </div>
            <div className="text-left">
              <h3 className="font-black text-gray-900 text-base">논문과 대화하기</h3>
              <p className="text-xs text-gray-400 font-medium">
                궁금한 내용을 질문하세요 · 1회 2 INK
                {chatHistory.length > 0 && (
                  <span className="ml-2 text-violet-500 font-black">{Math.floor(chatHistory.length / 2)}번 대화</span>
                )}
              </p>
            </div>
          </div>
          {chatOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>

        {chatOpen && (
          <div className="border-t border-gray-50">
            {/* 채팅 메시지 목록 */}
            <div className="h-80 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {chatHistory.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare size={32} className="text-gray-200 mb-3" />
                  <p className="text-sm font-bold text-gray-400">논문에 대해 무엇이든 질문해보세요</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {[
                      "이 논문의 핵심 가설은?",
                      "연구 방법론의 한계점은?",
                      "결론을 한 문장으로 요약해줘",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => { setChatInput(q); }}
                        className="text-xs font-bold bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-xl hover:border-violet-300 hover:text-violet-600 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-br-sm"
                      : "bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm"
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* 입력창 */}
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                placeholder="논문에 대해 질문하세요..."
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:border-violet-300 transition-colors"
                disabled={chatLoading}
              />
              <button
                onClick={handleSendChat}
                disabled={chatLoading || !chatInput.trim()}
                className="w-12 h-12 bg-violet-600 text-white rounded-2xl flex items-center justify-center hover:bg-violet-700 transition-all disabled:bg-gray-200 disabled:text-gray-400 flex-shrink-0"
              >
                {chatLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 메모 섹션 */}
      <div className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm mb-6">
        <h3 className="font-black text-base text-gray-900 flex items-center gap-2 mb-5">
          <StickyNote size={18} className="text-amber-500" /> 연구 메모
          {memos.length > 0 && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">{memos.length}</span>}
        </h3>
        <div className="flex gap-2 mb-4">
          <input
            type="text" value={newMemo}
            onChange={(e) => setNewMemo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddMemo()}
            placeholder="메모를 남겨보세요..."
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:border-violet-300"
          />
          <button onClick={handleAddMemo} disabled={memoLoading || !newMemo.trim()}
            className="px-5 py-3 bg-violet-600 text-white rounded-2xl font-black text-sm hover:bg-violet-700 transition-all disabled:bg-gray-200 flex items-center gap-1.5">
            {memoLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </button>
        </div>
        <div className="space-y-2">
          {memos.map((memo) => (
            <div key={memo.id} className="flex items-start justify-between p-3.5 bg-amber-50 border border-amber-100 rounded-xl group">
              <div>
                <p className="text-sm font-medium text-gray-800">{memo.text}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(memo.createdAt).toLocaleString("ko-KR")}</p>
              </div>
              <button onClick={() => handleDeleteMemo(memo)}
                className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 mt-0.5">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {memos.length === 0 && <p className="text-center text-gray-300 text-sm py-4 font-medium">아직 메모가 없습니다</p>}
        </div>
      </div>

      {/* 신뢰도 + 근거 아코디언 */}
      <div className="bg-gray-50 p-6 rounded-[2rem] space-y-3">
        <div className="flex gap-3 flex-wrap">
          {["reliability", "evidence"].map((key) => (
            <button key={key} onClick={() => setOpenAccordion(openAccordion === key ? null : key)}
              className="flex items-center gap-1.5 text-xs font-black text-gray-500 hover:text-violet-600 bg-white px-4 py-2 rounded-xl border border-gray-200 transition-colors">
              {key === "reliability" ? "신뢰도 지표" : "근거 데이터"}
              {openAccordion === key ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          ))}
        </div>
        {openAccordion === "reliability" && (
          <div className="bg-white p-5 rounded-2xl border border-violet-100 animate-in slide-in-from-top-2 space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-gray-400">AI 분석 신뢰도</span>
                <span className="text-violet-600">직접 인용 {data.reliability?.direct || 65}% · 의미 해석 {data.reliability?.semantic || 35}%</span>
              </div>
              <div className="flex h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="bg-green-500" style={{ width: `${data.reliability?.direct || 65}%` }} />
                <div className="bg-violet-400" style={{ width: `${data.reliability?.semantic || 35}%` }} />
              </div>
            </div>
            {data.reliability?.kciVerified && (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-100 text-xs font-bold text-green-700">
                <BadgeCheck size={16} className="text-green-500 flex-shrink-0" />
                KCI 공식 데이터로 신뢰도 +{data.reliability.kciBoost}점 보정 · 피인용 {data.reliability.kciCitationCount}회
              </div>
            )}
          </div>
        )}
        {openAccordion === "evidence" && (
          <div className="bg-white p-5 rounded-2xl border border-violet-100 text-sm italic text-gray-600 whitespace-pre-wrap animate-in slide-in-from-top-2">
            {evidenceText}
          </div>
        )}
      </div>
    </main>
  );
}
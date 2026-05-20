"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc, onSnapshot, collection, query, where, orderBy,
  limit, updateDoc, increment, setDoc, addDoc, serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { runUnifiedAnalysisAction } from "@/app/actions/analyze-action";
import { runBackgroundPreScan } from "@/app/actions/prescan-action";
import toast from "react-hot-toast";
import {
  Loader2, Files, XCircle, CheckCircle2, AlertTriangle,
  ArrowRight, Clock, FileText, ChevronRight, Plus,
  Lightbulb, BrainCircuit, Info,
} from "lucide-react";
import Link from "next/link";

const LOADING_MESSAGES = [
  "AI가 PDF 텍스트를 스캔하고 있습니다...",
  "논문 구조와 흐름을 파악하고 있습니다...",
  "표와 그래프 데이터를 분석 중입니다...",
  "학술적 관점에서 인사이트를 도출 중입니다...",
  "근거 데이터를 추출하고 있습니다...",
  "거의 다 되었습니다. 리포트를 작성 중입니다...",
];

export default function HomePage() {
  const router = useRouter();

  // ── 상태 관리 ────────────────────────────────────────────────
  const [files, setFiles]           = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [userData, setUserData]     = useState<any>(null);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);

  const [status, setStatus]         = useState<"idle" | "analyzing" | "success" | "error">("idle");
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [errorMsg, setErrorMsg]     = useState("");

  const [pdfMeta, setPdfMeta]       = useState({ pages: 0, chars: 0 });
  const [preScanData, setPreScanData] = useState<any>(null);
  const [isPreScanning, setIsPreScanning] = useState(false);
  const [sourceText, setSourceText] = useState("");

  const [confirmModal, setConfirmModal] = useState<any>(null);
  const [isRecharging, setIsRecharging] = useState(false);

  // ── 인증 & 데이터 구독 ───────────────────────────────────────
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAuthLoading(false);
        router.replace("/login");
        return;
      }
      const userRef = doc(db, "users", user.uid);
      const unsubUser = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          setUserData(snap.data());
        } else {
          setDoc(userRef, {
            email: user.email,
            inkBalance: 0,
            hasFreeTrial: true,
            analysisCount: 0,
            role: user.email === "ot.helper7@gmail.com" ? "admin" : "user",
            createdAt: serverTimestamp(),
          });
        }
        setAuthLoading(false);
      }, (err) => {
        console.error("Firestore Users Error:", err.message);
        setAuthLoading(false);
      });

      const q = query(
        collection(db, "knowledge_library"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(3)
      );
      const unsubDocs = onSnapshot(q, (snap) => {
        setRecentDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });

      return () => { unsubUser(); unsubDocs(); };
    });
    return () => unsubAuth();
  }, [router]);

  // ── 로딩 메시지 순환 ─────────────────────────────────────────
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === "analyzing") {
      interval = setInterval(
        () => setLoadingMsgIdx((p) => (p + 1) % LOADING_MESSAGES.length),
        4500
      );
    }
    return () => clearInterval(interval);
  }, [status]);

  const isAdminUser =
    userData?.role === "admin" || auth.currentUser?.email === "ot.helper7@gmail.com";

  // ── Admin 충전 ───────────────────────────────────────────────
  const handleRechargeInk = async (amount: number) => {
    if (!auth.currentUser || !isAdminUser) return;
    setIsRecharging(true);
    const t = toast.loading(`[ADMIN] Charging ${amount} INK...`);
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        inkBalance: increment(amount),
      });
      await addDoc(collection(db, "recharge_requests"), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email,
        amount,
        status: "completed",
        type: "admin_instant",
        createdAt: serverTimestamp(),
      });
      toast.success("Charged!", { id: t });
      if (confirmModal) setConfirmModal(null);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`, { id: t });
    } finally {
      setIsRecharging(false);
    }
  };

  // ── PDF 업로드 & Pre-scan ────────────────────────────────────
  const handleFileChange = async (newFiles: File[]) => {
    const pdfFiles = newFiles.filter((f) => f.type === "application/pdf");
    if (pdfFiles.length === 0) return toast.error("PDF 파일만 업로드 가능합니다.");
    setFiles(pdfFiles);
    setPreScanData(null);
    setPdfMeta({ pages: 0, chars: 0 });
    setSourceText("");

    toast.loading("논문 읽는 중...", { id: "parsing" });
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

      let totalPages = 0;
      let totalChars = 0;
      let fullText = "";

      for (const file of pdfFiles) {
        const arrayBuffer = await file.arrayBuffer();
        // @ts-ignore
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, disableWorker: true, verbosity: 0 }).promise;
        totalPages += pdf.numPages;
        for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((item: any) => item.str).join(" ");
          if (i <= 5) totalChars += pageText.length;
          fullText += pageText + " ";
        }
        if (pdf.numPages > 5) totalChars = Math.floor((totalChars / 5) * pdf.numPages);
      }
      setPdfMeta({ pages: totalPages, chars: totalChars });
      setSourceText(fullText);
      toast.success(`${totalPages}P 확인 완료`, { id: "parsing" });

      // Pre-scan (단일 파일만)
      if (pdfFiles.length === 1) {
        setIsPreScanning(true);
        const base64 = Buffer.from(await pdfFiles[0].arrayBuffer()).toString("base64");
        const scanRes = await runBackgroundPreScan(base64, pdfFiles[0].type);
        if (scanRes.success) setPreScanData(scanRes.data);
        setIsPreScanning(false);
      }
    } catch (err: any) {
      console.error("PDF Engine Error:", err);
      toast.error("PDF 파싱 오류. 다시 시도해주세요.", { id: "parsing" });
    }
  };

  // ── 청구서 모달 오픈 ─────────────────────────────────────────
  const handleOpenModal = () => {
    if (files.length === 0) return toast.error("먼저 논문을 선택해주세요.");
    const isMulti = files.length > 1;
    // UI 표시용 예상 비용 (실제 차감은 서버에서 계산 — 버그 3 수정)
    const cost = isMulti ? 10 + files.length * 8 : 15;
    const inkBalance = userData?.inkBalance || 0;
    // ✅ 버그 2 수정: hasFreeTrial 단독 조건
    const isFree = !isMulti && userData?.hasFreeTrial === true;
    const isShortage = !isFree && inkBalance < cost;
    setConfirmModal({ cost, isShortage, inkBalance, isFree });
  };

  // ── 분석 실행 ────────────────────────────────────────────────
  const executeAnalysis = async () => {
    if (!confirmModal || confirmModal.isShortage) return;
    setStatus("analyzing");
    setConfirmModal(null);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      formData.append("userId", auth.currentUser!.uid);
      // ✅ 단순화: 모드/스타일 고정값 전달 (사용자 선택 UI 제거)
      formData.append("mode", "understand");
      formData.append("style", "academic");
      // ✅ 버그 3 수정: totalCost 클라이언트 전달 제거
      formData.append("addons", JSON.stringify({ visualization: false, deepKeyword: false }));
      formData.append("sourceText", sourceText);

      const res = await runUnifiedAnalysisAction(formData);

      if (res.success && res.data) {
        setStatus("success");
        if (res.data.refundReason) toast.success(res.data.refundReason);
        setTimeout(() => router.push(`/analysis/${res.data.docId}`), 1500);
      } else {
        setStatus("error");
        setErrorMsg(res.message || "분석 중 오류가 발생했습니다.");
      }
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "서버 연결 실패");
    }
  };

  if (authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-violet-600" size={40} />
      </div>
    );

  return (
    <main className="pt-32 pb-32 px-6 max-w-3xl mx-auto font-sans selection:bg-violet-100 selection:text-violet-900">

      {/* ── IDLE ───────────────────────────────────────────────── */}
      {status === "idle" && (
        <div className="animate-in fade-in duration-700">

          {/* 히어로 */}
          <div className="text-center mb-14">
            <h1 className="text-5xl sm:text-6xl font-black italic tracking-tighter text-gray-900 mb-3 uppercase leading-none">
              논문, <span className="text-violet-600">AI로 읽다.</span>
            </h1>
            <p className="text-gray-400 font-medium text-base">
              PDF를 올리면 분석부터 채팅까지 한 번에
            </p>

            {/* 잉크 바 */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <div className="flex items-center gap-4 bg-white border border-gray-100 px-6 py-3 rounded-2xl shadow-sm">
                <span className="text-2xl font-black text-violet-600">
                  🖋️ {userData?.inkBalance || 0}
                </span>
                {userData?.hasFreeTrial && (
                  <span className="text-xs font-black text-violet-500 bg-violet-50 px-3 py-1 rounded-xl">
                    첫 분석 무료
                  </span>
                )}
                {isAdminUser && (
                  <button
                    onClick={() => handleRechargeInk(100)}
                    disabled={isRecharging}
                    className="flex items-center gap-1 bg-black text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-violet-600 transition-all"
                  >
                    {isRecharging ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    충전
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 드롭존 */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileChange(Array.from(e.dataTransfer.files)); }}
            className={`relative bg-white border-2 border-dashed rounded-[3rem] p-16 mb-6 text-center transition-all duration-300 ${
              isDragging ? "border-violet-500 bg-violet-50 scale-[1.01]" : "border-gray-200 hover:border-violet-300 shadow-sm"
            }`}
          >
            <input
              type="file" multiple accept=".pdf"
              onChange={(e) => handleFileChange(Array.from(e.target.files || []))}
              className="hidden" id="pdf-upload"
            />
            <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all ${
                files.length > 0 ? "bg-violet-600 text-white shadow-lg" : "bg-gray-50 text-gray-300"
              }`}>
                <Files size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-900 italic">
                {files.length > 0
                  ? `${files.length}개 논문 선택됨`
                  : "PDF 논문을 여기에 끌어다 놓으세요"}
              </h3>
              <p className="text-xs text-gray-400 mt-2 font-bold uppercase tracking-widest">
                PDF only · 원본 1시간 후 자동 삭제
              </p>
            </label>

            {files.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-xs font-black">
                    <span className="truncate max-w-[160px]">{f.name}</span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        const next = files.filter((_, idx) => idx !== i);
                        setFiles(next);
                        if (next.length === 0) setPreScanData(null);
                      }}
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pre-scan 결과 */}
          {isPreScanning && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl mb-6 border border-gray-100">
              <Loader2 size={16} className="animate-spin text-violet-500 flex-shrink-0" />
              <span className="text-sm font-bold text-gray-500">논문 복잡도 분석 중...</span>
            </div>
          )}

          {preScanData && !isPreScanning && (
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5 mb-6 animate-in slide-in-from-bottom-4">
              <div className="flex items-start gap-3">
                <Info size={16} className="text-violet-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-gray-800 mb-2">{preScanData.summary}</p>
                  {preScanData.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {preScanData.keywords.slice(0, 5).map((kw: string, i: number) => (
                        <span key={i} className="text-[11px] font-black bg-white text-violet-600 px-2.5 py-1 rounded-full border border-violet-200">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 분석 시작 버튼 */}
          {files.length > 0 && (
            <button
              onClick={handleOpenModal}
              className="w-full py-8 bg-black text-white rounded-[2.5rem] font-black text-2xl shadow-xl hover:bg-violet-600 hover:-translate-y-1 transition-all flex items-center justify-center gap-6 uppercase tracking-tighter group"
            >
              <span className="italic">분석 시작</span>
              <ArrowRight size={36} className="group-hover:translate-x-2 transition-transform" />
            </button>
          )}

          {/* 최근 분석 */}
          {recentDocs.length > 0 && (
            <div className="mt-20">
              <h3 className="font-black text-2xl text-gray-900 mb-6 flex items-center gap-3 italic uppercase tracking-tighter">
                <Clock className="text-violet-500" size={24} /> 최근 분석
              </h3>
              <div className="space-y-3">
                {recentDocs.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/analysis/${doc.id}`}
                    className="flex items-center justify-between bg-white border border-gray-100 p-5 rounded-2xl hover:border-violet-200 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300 group-hover:bg-violet-600 group-hover:text-white transition-all">
                        <FileText size={22} />
                      </div>
                      <p className="font-black text-gray-900 text-base italic truncate max-w-[280px]">
                        {doc.title}
                      </p>
                    </div>
                    <ChevronRight size={20} className="text-gray-200 group-hover:text-violet-500 transition-all" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 청구서 모달 ─────────────────────────────────────────── */}
      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl px-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-300 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-t-[3rem]" />
            <h3 className="text-3xl font-black text-gray-900 mb-8 italic uppercase tracking-tighter">
              분석 청구서
            </h3>
            <div className="bg-gray-50 rounded-[2rem] p-8 mb-8 space-y-5 text-left">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">필요 INK</span>
                <span className="font-black text-xl">🖋️ {confirmModal.cost}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">보유 INK</span>
                <span className={`font-black text-xl ${confirmModal.isShortage ? "text-red-500" : ""}`}>
                  🖋️ {confirmModal.inkBalance}
                </span>
              </div>
              <hr className="border-gray-200" />
              <div className="flex justify-between items-center">
                <span className="font-black text-xl">차감</span>
                <span className="text-4xl font-black text-violet-600">
                  🖋️ {confirmModal.isFree ? "FREE" : confirmModal.cost}
                </span>
              </div>
              {confirmModal.isShortage && (
                <div className="flex items-center gap-3 bg-red-500 text-white p-4 rounded-2xl text-xs font-black">
                  <AlertTriangle size={24} className="animate-bounce flex-shrink-0" />
                  <span>
                    잉크가 부족합니다.{" "}
                    <Link href="/library/ink" className="underline" onClick={() => setConfirmModal(null)}>
                      충전소 바로가기
                    </Link>
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {confirmModal.isShortage ? (
                isAdminUser ? (
                  <button
                    onClick={() => handleRechargeInk(100)}
                    disabled={isRecharging}
                    className="w-full py-5 bg-violet-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2 hover:bg-violet-700 transition-all"
                  >
                    {isRecharging ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                    즉시 충전
                  </button>
                ) : null
              ) : (
                <button
                  onClick={executeAnalysis}
                  className="w-full py-5 bg-black text-white rounded-2xl font-black text-xl hover:bg-violet-600 transition-all uppercase tracking-tighter"
                >
                  시작하기
                </button>
              )}
              <button
                onClick={() => setConfirmModal(null)}
                className="w-full py-3 bg-gray-100 text-gray-500 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-200 transition-all"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 분석 중 ──────────────────────────────────────────────── */}
      {status === "analyzing" && (
        <div className="flex flex-col items-center justify-center min-h-[75vh] animate-in zoom-in-95 duration-700">
          <div className="relative mb-16">
            <div className="w-52 h-52 bg-violet-100 rounded-full animate-ping absolute inset-0 opacity-30" />
            <div className="w-52 h-52 bg-violet-600 rounded-full flex items-center justify-center relative z-10 shadow-[0_0_100px_rgba(139,92,246,0.5)]">
              <Loader2 size={90} className="text-white animate-spin" />
            </div>
            <div className="absolute -top-8 -right-8 animate-bounce">
              <Lightbulb size={48} className="text-yellow-400 drop-shadow-lg" />
            </div>
            <div className="absolute -bottom-8 -left-8 animate-bounce" style={{ animationDelay: "300ms" }}>
              <BrainCircuit size={48} className="text-violet-400 drop-shadow-lg" />
            </div>
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-6 uppercase tracking-tighter italic text-center">
            분석 중...
          </h2>
          <div className="bg-white border border-gray-100 px-10 py-6 rounded-[2.5rem] shadow-lg text-center max-w-md">
            <p className="text-gray-500 font-black animate-pulse">{LOADING_MESSAGES[loadingMsgIdx]}</p>
          </div>
        </div>
      )}

      {/* ── 성공 ──────────────────────────────────────────────────── */}
      {status === "success" && (
        <div className="flex flex-col items-center justify-center min-h-[75vh]">
          <div className="w-48 h-48 bg-green-500 rounded-[3rem] flex items-center justify-center mb-12 shadow-[0_20px_60px_rgba(34,197,94,0.4)] animate-bounce">
            <CheckCircle2 size={100} className="text-white" />
          </div>
          <h2 className="text-6xl font-black text-gray-900 italic uppercase tracking-tighter">완료!</h2>
        </div>
      )}

      {/* ── 에러 ──────────────────────────────────────────────────── */}
      {status === "error" && (
        <div className="flex flex-col items-center justify-center min-h-[75vh] text-center px-6">
          <div className="w-48 h-48 bg-red-50 rounded-[3rem] flex items-center justify-center mb-12 shadow-xl">
            <AlertTriangle size={80} className="text-red-400" />
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-4 uppercase italic">분석 실패</h2>
          <p className="text-gray-500 font-bold mb-3 max-w-md bg-white p-6 rounded-[2rem] border border-red-50 shadow-lg">
            {errorMsg}
          </p>
          <p className="text-sm text-gray-400 mb-8">소모된 INK는 자동 환불됩니다.</p>
          <button
            onClick={() => { setStatus("idle"); setErrorMsg(""); }}
            className="px-10 py-5 bg-black text-white rounded-[2rem] font-black text-xl uppercase hover:bg-violet-600 transition-all"
          >
            다시 시도
          </button>
        </div>
      )}
    </main>
  );
}
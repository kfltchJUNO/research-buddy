"use server";

import { db } from "@/lib/firebase";
import { 
  doc, 
  runTransaction, 
  collection, 
  serverTimestamp, 
  getDocs, 
  query, 
  where, 
  documentId 
} from "firebase/firestore";
import { analyzeWithGeminiPro, analyzeMulti } from "@/services/gemini-service";

const INK_COSTS = { 
  scan: 5, 
  understand: 10, 
  think: 15, 
  multi: 40 
};

/**
 * [단일 분석] UploadZone에서 호출하는 고속 스캔 함수
 */
export async function startQuickScan(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;
    
    if (!file || !userId) throw new Error("필수 정보가 누락되었습니다.");

    const content = "분석 대상 논문의 텍스트 데이터 예시입니다. 실제 구현 시 PDF 본문 텍스트가 여기에 위치합니다."; 

    const result = await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("유저 정보가 없습니다.");

      const currentInk = userSnap.data().inkBalance || 0;
      if (currentInk < INK_COSTS.scan) throw new Error("잉크가 부족합니다.");

      // Gemini AI 분석 실행 (타입 에러 방지를 위해 'scan' 단언)
      const analysisData = await analyzeWithGeminiPro(content, 'scan' as any);

      const newDocRef = doc(collection(db, "knowledge_library"));
      transaction.update(userRef, { inkBalance: currentInk - INK_COSTS.scan });
      transaction.set(newDocRef, {
        userId,
        title: file.name,
        plainTextContent: content,
        mode: "scan",
        ...analysisData,
        createdAt: serverTimestamp(),
      });

      return { 
        docId: newDocRef.id,
        keywords: analysisData.keywords || [],
        oneLineSummary: analysisData.oneLineSummary || ""
      };
    });

    return { success: true, data: result, message: "분석이 성공적으로 완료되었습니다." };
  } catch (error: any) {
    return { success: false, message: error.message || error.toString() };
  }
}

/**
 * [재분석] PerspectiveShiftUI 등에서 요청하는 분석 모드 전환
 */
export async function reAnalyzeAction(docId: string, userId: string, mode: string) {
  try {
    const cost = (INK_COSTS as any)[mode] || 10;

    const result = await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", userId);
      const docRef = doc(db, "knowledge_library", docId);
      
      const [userSnap, docSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(docRef)
      ]);

      if (!userSnap.exists() || !docSnap.exists()) throw new Error("정보를 찾을 수 없습니다.");

      const currentInk = userSnap.data().inkBalance || 0;
      if (currentInk < cost) throw new Error("잉크가 부족합니다.");

      const content = docSnap.data().plainTextContent;
      const analysisData = await analyzeWithGeminiPro(content, mode as any);

      transaction.update(userRef, { inkBalance: currentInk - cost });
      transaction.update(docRef, {
        mode,
        ...analysisData,
        updatedAt: serverTimestamp(),
      });

      return { success: true, message: "분석이 업데이트되었습니다." };
    });

    return result;
  } catch (error: any) {
    return { success: false, message: error.message || error.toString() };
  }
}

/**
 * [비교 분석] 여러 논문을 취합하여 Gemini로 분석하는 핵심 로직
 */
export async function runMultiAnalysisAction(userId: string, docIds: string[]) {
  try {
    return await runTransaction(db, async (transaction) => {
      const userRef = doc(db, "users", userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("유저 정보가 없습니다.");
      
      const currentInk = userSnap.data().inkBalance || 0;
      if (currentInk < INK_COSTS.multi) throw new Error("잉크가 부족합니다.");

      const libraryRef = collection(db, "knowledge_library");
      const q = query(libraryRef, where(documentId(), "in", docIds));
      const docsSnap = await getDocs(q);
      
      const contents = docsSnap.docs.map(d => ({
        title: d.data().title,
        text: d.data().plainTextContent?.substring(0, 5000) || ""
      }));

      const analysisData = await analyzeMulti(contents);
      const newReportRef = doc(collection(db, "knowledge_library"));

      transaction.update(userRef, { inkBalance: currentInk - INK_COSTS.multi });
      transaction.set(newReportRef, {
        userId,
        title: `${contents.length}개 논문 비교 분석 리포트`,
        mode: "multi",
        ...analysisData,
        createdAt: serverTimestamp(),
      });

      return { success: true, docId: newReportRef.id, message: "비교 분석이 완료되었습니다." };
    });
  } catch (error: any) {
    return { success: false, message: error.toString() };
  }
}
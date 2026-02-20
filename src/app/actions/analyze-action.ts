"use server";

import { db } from "@/lib/firebase";
import { doc, runTransaction, collection, serverTimestamp, getDocs, query, where, documentId } from "firebase/firestore";
import { analyzeWithGeminiPro, analyzeMulti } from "@/services/gemini-service";

const INK_COSTS = { scan: 5, understand: 10, think: 15, multi: 40 };

/**
 * [Multi-Think] 선택된 여러 논문 비교 분석 실행
 */
export async function runMultiAnalysisAction(userId: string, docIds: string[]) {
  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. 유저 잉크 확인
      const userRef = doc(db, "users", userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw "유저 정보가 없습니다.";
      
      const currentInk = userSnap.data().inkBalance;
      if (currentInk < INK_COSTS.multi) throw "잉크가 부족합니다.";

      // 2. 선택된 문서들의 텍스트 가져오기
      const libraryRef = collection(db, "knowledge_library");
      const q = query(libraryRef, where(documentId(), "in", docIds));
      const docsSnap = await getDocs(q);
      
      const contents = docsSnap.docs.map(d => ({
        title: d.data().title,
        text: d.data().plainTextContent.substring(0, 5000) // 컨텍스트 제한 고려
      }));

      // 3. Gemini 비교 분석 실행
      const analysisData = await analyzeMulti(contents);

      // 4. 결과 저장 및 잉크 차감
      const newReportRef = doc(collection(db, "knowledge_library"));
      transaction.update(userRef, { inkBalance: currentInk - INK_COSTS.multi });
      transaction.set(newReportRef, {
        userId,
        title: `${contents.length}개 논문 비교 분석 리포트`,
        mode: "multi",
        ...analysisData,
        createdAt: serverTimestamp(),
      });

      return { docId: newReportRef.id };
    });

    return { success: true, docId: result.docId };
  } catch (error: any) {
    return { success: false, message: error.toString() };
  }
}
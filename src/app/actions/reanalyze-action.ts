// src/app/actions/reanalyze-action.ts
"use server";

import { db, storage } from "@/lib/firebase";
import { doc, getDoc, collection, serverTimestamp, runTransaction, increment } from "firebase/firestore";
import { ref, getBytes } from "firebase/storage";
import { analyzeReanalysisDirect } from "@/services/gemini-service";

export async function runReanalyzeAction(docId: string, perspective: string, userId: string) {
  try {
    // 1. 기존 문서 찾기 및 유효성 검사
    const originalDocRef = doc(db, "knowledge_library", docId);
    const originalDocSnap = await getDoc(originalDocRef);
    if (!originalDocSnap.exists()) throw new Error("원본 분석 기록을 찾을 수 없습니다.");
    
    const originalData = originalDocSnap.data();
    if (originalData.userId !== userId) throw new Error("권한이 없습니다.");
    
    // 1시간 초과 검사 (보안)
    const createdAt = originalData.createdAt.toDate();
    if (new Date().getTime() - createdAt.getTime() > 60 * 60 * 1000) {
      throw new Error("보안을 위해 원본 파일이 영구 삭제되어 재분석할 수 없습니다.");
    }

    // 2. 20% 할인 잉크 결제 트랜잭션
    const originalCost = originalData.originalCost || 20;
    const discountedCost = Math.max(1, Math.ceil(originalCost * 0.8)); // 20% 할인, 최소 1 Ink
    
    const userRef = doc(db, "users", userId);
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const currentInk = userSnap.data()?.inkBalance || 0;
      if (currentInk < discountedCost) throw new Error(`잉크 부족 (할인가: ${discountedCost} INK 필요)`);
      transaction.update(userRef, { inkBalance: increment(-discountedCost) });
    });

    // 3. 파이어베이스 스토리지에서 원본 파일 다시 다운로드!
    const storagePaths = originalData.storagePaths as string[];
    if (!storagePaths || storagePaths.length === 0) throw new Error("저장된 원본 파일이 없습니다.");

    // (현재는 단일 파일 재분석 우선 지원 - 다중 파일 확장 가능)
    const fileRef = ref(storage, storagePaths[0]);
    const fileBuffer = await getBytes(fileRef);
    const base64Data = Buffer.from(fileBuffer).toString("base64");

    // 4. 새로운 관점으로 Gemini AI 호출
    const style = originalData.style || 'academic';
    const analysisResult = await analyzeReanalysisDirect(base64Data, "application/pdf", perspective, style);

    // 5. 새로운 관점의 결과를 DB에 신규 저장
    const newDocRef = doc(collection(db, "knowledge_library"));
    await runTransaction(db, async (transaction) => {
      transaction.set(newDocRef, {
        userId,
        title: `[${perspective}] ${originalData.title}`,
        analysisResult: analysisResult.summary,
        mode: `re-think (${perspective})`,
        style,
        storagePaths, // 같은 열쇠 공유
        originalCost,
        createdAt: serverTimestamp(),
      });
    });

    return { success: true, data: { newDocId: newDocRef.id, cost: discountedCost } };

  } catch (err: any) {
    console.error("Re-analyze Error:", err.message);
    return { success: false, message: err.message };
  }
}
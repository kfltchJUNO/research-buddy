// src/app/actions/reanalyze-action.ts
"use server";

import { db, storage } from "@/lib/firebase";
import {
  doc, getDoc, collection, serverTimestamp, runTransaction, increment,
} from "firebase/firestore";
import { ref, getBytes } from "firebase/storage";
import { analyzeReanalysisDirect } from "@/services/gemini-service";

export async function runReanalyzeAction(
  docId: string,
  perspective: string,
  userId: string
) {
  try {
    const originalDocRef = doc(db, "knowledge_library", docId);
    const originalDocSnap = await getDoc(originalDocRef);
    if (!originalDocSnap.exists()) throw new Error("원본 분석 기록을 찾을 수 없습니다.");

    const originalData = originalDocSnap.data();
    if (originalData.userId !== userId) throw new Error("권한이 없습니다.");

    const createdAt = originalData.createdAt.toDate();
    if (new Date().getTime() - createdAt.getTime() > 60 * 60 * 1000) {
      throw new Error("보안을 위해 원본 파일이 영구 삭제되어 재분석할 수 없습니다.");
    }

    const originalCost = originalData.originalCost || 20;
    const discountedCost = Math.max(1, Math.ceil(originalCost * 0.8));

    const userRef = doc(db, "users", userId);
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const currentInk = userSnap.data()?.inkBalance || 0;
      if (currentInk < discountedCost)
        throw new Error(`잉크 부족 (할인가: ${discountedCost} INK 필요)`);
      transaction.update(userRef, { inkBalance: increment(-discountedCost) });
    });

    const storagePaths = originalData.storagePaths as string[];
    if (!storagePaths || storagePaths.length === 0)
      throw new Error("저장된 원본 파일이 없습니다.");

    const fileRef = ref(storage, storagePaths[0]);
    const fileBuffer = await getBytes(fileRef);
    const base64Data = Buffer.from(fileBuffer).toString("base64");

    const style = originalData.style || "academic";
    const analysisResult = await analyzeReanalysisDirect(
      base64Data,
      "application/pdf",
      perspective,
      style
    );

    const newDocRef = doc(collection(db, "knowledge_library"));
    await runTransaction(db, async (transaction) => {
      transaction.set(newDocRef, {
        userId,
        title: `[${perspective}] ${originalData.title}`,
        analysisResult: analysisResult.summary,
        mode: `re-think (${perspective})`,
        style,
        storagePaths,
        originalCost,
        inkCost: discountedCost,
        isFavorite: false,
        memos: [],
        createdAt: serverTimestamp(),
      });
    });

    return { success: true, data: { newDocId: newDocRef.id, cost: discountedCost } };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
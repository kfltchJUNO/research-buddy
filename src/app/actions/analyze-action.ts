// src/app/actions/analyze-action.ts
"use server";

import { analyzePDFDirect, analyzeMultiDirect } from "@/services/gemini-service";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, serverTimestamp, runTransaction, increment } from "firebase/firestore";

export async function runUnifiedAnalysisAction(formData: FormData) {
  try {
    const userId = formData.get("userId") as string;
    const mode = (formData.get("mode") as any) || 'scan';
    const rawFiles = formData.getAll("files") as File[];

    if (!userId || rawFiles.length === 0) throw new Error("분석할 파일이 없습니다.");

    // 🚀 1. 유저 상태 사전 검사 (API 호출 전에 미리 체크)
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("유저 정보를 찾을 수 없습니다.");

    const userData = userSnap.data();
    const isMulti = rawFiles.length > 1;
    const cost = isMulti ? 30 : (mode === 'think' ? 15 : 10);
    const currentInk = userData.inkBalance || 0;

    const isFirstFree = !isMulti && (userData.hasFreeTrial === true || !userData.analysisCount || userData.analysisCount === 0);

    // 잉크가 없으면 아예 여기서 차단 (UI에 정확히 전달됨)
    if (!isFirstFree && currentInk < cost) {
      throw new Error(`잉크가 부족합니다. (필요: ${cost} / 현재: ${currentInk})`);
    }

    // 🚀 2. 파일 변환 부분 수정
    const filePromises = rawFiles.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      
      // ✅ 한글 파일명 깨짐 복구 마법! (Latin1 -> UTF-8)
      const decodedTitle = Buffer.from(file.name, 'latin1').toString('utf8');
      
      return { base64, title: decodedTitle, mimeType: file.type };
    });
    const processedFiles = await Promise.all(filePromises);

    // 🚀 3. AI 분석 실행 (DB 락을 걸지 않고 자유롭게 연산하도록 밖으로 뺌)
    const analysisResult = isMulti 
      ? await analyzeMultiDirect(processedFiles)
      : await analyzePDFDirect(processedFiles[0].base64, mode);

    // 🚀 4. 분석 결과 저장 및 잉크 차감 (가장 빠르고 안전한 트랜잭션)
    const docId = await runTransaction(db, async (transaction) => {
      const freshUserSnap = await transaction.get(userRef);
      const freshUserData = freshUserSnap.data()!;
      const freshIsFirstFree = !isMulti && (freshUserData.hasFreeTrial === true || !freshUserData.analysisCount || freshUserData.analysisCount === 0);

      // 무료권 차감 OR 잉크 차감
      if (freshIsFirstFree) {
        transaction.update(userRef, { hasFreeTrial: false, analysisCount: increment(1) });
      } else {
        transaction.update(userRef, { inkBalance: increment(-cost), analysisCount: increment(1) });
      }

      const newDocRef = doc(collection(db, "knowledge_library"));
      transaction.set(newDocRef, {
        userId,
        title: isMulti ? `${processedFiles[0].title} 외 ${processedFiles.length - 1}건` : processedFiles[0].title,
        analysisResult: analysisResult.summary,
        mode,
        createdAt: serverTimestamp(),
      });

      return newDocRef.id;
    });

    return { success: true, data: { docId } };
  } catch (err: any) {
    console.error("🔥 Analysis Action Error:", err.message);
    return { success: false, message: err.message };
  }
}
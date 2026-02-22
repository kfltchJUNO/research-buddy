"use server";

import { analyzePDFDirect, analyzeMultiDirect, extractVisualizationData, calculateReliabilityIndicator } from "@/services/gemini-service";
import { db, storage } from "@/lib/firebase";
import { doc, collection, serverTimestamp, runTransaction, increment, getDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";

// 🚀 [액션 1] 통합 분석 실행 (Main Analysis)
export async function runUnifiedAnalysisAction(formData: FormData) {
  const userId = formData.get("userId") as string;
  const mode = (formData.get("mode") as any) || 'scan';
  const style = (formData.get("style") as any) || 'academic';
  const totalCostStr = formData.get("totalCost") as string;
  const cost = parseInt(totalCostStr, 10);
  const addons = JSON.parse((formData.get("addons") as string) || "{}");
  const rawFiles = formData.getAll("files") as File[];
  const sourceText = (formData.get("sourceText") as string) || "";

  if (!userId || rawFiles.length === 0) return { success: false, message: "분석할 파일이 없습니다." };

  const userRef = doc(db, "users", userId);
  const isMulti = rawFiles.length > 1;
  let isFirstFree = false;

  try {
    // 1. 잉크 정산 트랜잭션
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("유저 정보를 찾을 수 없습니다.");
      
      const currentInk = userSnap.data().inkBalance || 0;
      isFirstFree = !isMulti && (userSnap.data().hasFreeTrial === true || !userSnap.data().analysisCount || userSnap.data().analysisCount === 0);

      if (!isFirstFree && currentInk < cost) throw new Error("잉크가 부족합니다.");
      
      if (isFirstFree) {
        transaction.update(userRef, { hasFreeTrial: false, holdingFreeTrial: true });
      } else {
        transaction.update(userRef, { inkBalance: increment(-cost), holdingInk: increment(cost) });
      }
    });

    // 2. 파일 스토리지 업로드 및 데이터 가공
    const processedFiles = await Promise.all(rawFiles.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const filePath = `temp_papers/${userId}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, new Uint8Array(arrayBuffer), { contentType: file.type });
      return { base64, title: file.name, mimeType: file.type, filePath };
    }));

    // 3. AI 분석 및 시각화 병렬 처리
    const [analysisResult, visualizationData] = await Promise.all([
      isMulti 
        ? analyzeMultiDirect(processedFiles, style, addons) 
        : analyzePDFDirect(processedFiles[0].base64, mode, style, addons),
      addons.visualization ? extractVisualizationData(processedFiles) : Promise.resolve(null)
    ]);

    // 4. RAG 신뢰도 지표 산출
    const reliability = await calculateReliabilityIndicator(sourceText, analysisResult.summary);

    // 5. 최종 결과 저장 및 잉크 확정
    const docId = await runTransaction(db, async (transaction) => {
      transaction.update(userRef, { holdingInk: 0, holdingFreeTrial: false, analysisCount: increment(1) });
      const newDocRef = doc(collection(db, "knowledge_library"));
      const storagePaths = processedFiles.map(f => f.filePath);
      
      transaction.set(newDocRef, {
        userId,
        title: processedFiles[0].title,
        analysisResult: analysisResult.summary,
        visualizationData,
        reliability,
        mode,
        style,
        storagePaths,
        originalCost: cost,
        createdAt: serverTimestamp()
      });
      return newDocRef.id;
    });

    return { success: true, data: { docId } };

  } catch (err: any) {
    console.error("🔥 분석 실패:", err.message);
    return { success: false, message: err.message };
  }
}

// 🚀 [액션 2] 관점 전환 재분석 (Perspective Shift - 빌드 에러 해결 포인트)
export async function reAnalyzeAction(docId: string, perspective: string, userId: string) {
  try {
    const userRef = doc(db, "users", userId);
    const docRef = doc(db, "knowledge_library", docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error("원본 기록을 찾을 수 없습니다.");
    const originalData = docSnap.data();

    // 1시간 파기 체크
    const createdAt = originalData.createdAt.toDate();
    const now = new Date();
    if (now.getTime() - createdAt.getTime() > 60 * 60 * 1000) {
      throw new Error("보안 정책에 따라 원본 파일이 파기되어 재분석이 불가능합니다.");
    }

    // 재분석 비용 산정 (기본 20% 할인 적용: 약 8~12 Ink)
    const reAnalysisCost = 8; 

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if ((userSnap.data()?.inkBalance || 0) < reAnalysisCost) throw new Error("잉크가 부족합니다.");
      transaction.update(userRef, { inkBalance: increment(-reAnalysisCost) });
    });

    // 2. 재분석 수행 로직 (단일 파일 기준 가정)
    // 실제 구현 시 스토리지에서 파일을 다시 읽거나 기존 Base64 세션을 활용합니다.
    // 여기서는 구조를 위해 성공 응답을 반환합니다.
    
    return { success: true, data: { newDocId: docId, cost: reAnalysisCost } };

  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
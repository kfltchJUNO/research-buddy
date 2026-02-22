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
  let refundReason = ""; // 💸 환불 사유 변수 초기화

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

    // 2. 파일 스토리지 업로드
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

    // 4. [환불 검증] 시각화 데이터가 없으면 환불 사유 작성
    let finalVizData = visualizationData;
    let actualRefund = 0;
    if (addons.visualization && (!visualizationData || !visualizationData.data_points || visualizationData.data_points.length === 0)) {
      finalVizData = null;
      actualRefund = 5;
      refundReason = "추출할 시각화 데이터가 없어 5 INK가 자동 환불되었습니다.";
    }

    // 5. RAG 신뢰도 지표 산출
    const reliability = await calculateReliabilityIndicator(sourceText, analysisResult.summary);

    // 6. 최종 결과 저장 및 잉크 최종 확정
    const docId = await runTransaction(db, async (transaction) => {
      transaction.update(userRef, { 
        holdingInk: 0, 
        holdingFreeTrial: false, 
        inkBalance: increment(actualRefund),
        analysisCount: increment(1) 
      });

      const newDocRef = doc(collection(db, "knowledge_library"));
      const storagePaths = processedFiles.map(f => f.filePath);
      
      transaction.set(newDocRef, {
        userId,
        title: processedFiles[0].title,
        analysisResult: analysisResult.summary,
        visualizationData: finalVizData,
        reliability,
        mode,
        style,
        storagePaths,
        originalCost: cost - actualRefund,
        createdAt: serverTimestamp()
      });
      return newDocRef.id;
    });

    // ✅ 리턴값에 refundReason을 포함하여 타입 에러를 방지합니다.
    return { success: true, data: { docId, refundReason } };

  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// 🚀 [액션 2] 관점 전환 재분석 (Perspective Shift)
export async function reAnalyzeAction(docId: string, perspective: string, userId: string) {
  try {
    const userRef = doc(db, "users", userId);
    const docRef = doc(db, "knowledge_library", docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error("원본 기록을 찾을 수 없습니다.");
    const originalData = docSnap.data();

    // 재분석 비용 산정 (기본 20% 할인 적용)
    const reAnalysisCost = 8; 

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if ((userSnap.data()?.inkBalance || 0) < reAnalysisCost) throw new Error("잉크가 부족합니다.");
      transaction.update(userRef, { inkBalance: increment(-reAnalysisCost) });
    });
    
    return { success: true, data: { newDocId: docId, cost: reAnalysisCost } };

  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
// src/app/actions/analyze-action.ts
"use server";

import { analyzePDFDirect, analyzeMultiDirect, extractVisualizationData, calculateReliabilityIndicator } from "@/services/gemini-service";
import { db, storage } from "@/lib/firebase";
import { doc, collection, serverTimestamp, runTransaction, increment } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";

async function rollbackInk(userRef: any, isFirstFree: boolean, cost: number) {
  try {
    await runTransaction(db, async (transaction) => {
      if (isFirstFree) transaction.update(userRef, { hasFreeTrial: true, holdingFreeTrial: false });
      else transaction.update(userRef, { inkBalance: increment(cost), holdingInk: increment(-cost) });
    });
  } catch (err) { console.error("잉크 환불 실패", err); }
}

export async function runUnifiedAnalysisAction(formData: FormData) {
  const userId = formData.get("userId") as string;
  const mode = (formData.get("mode") as any) || 'scan';
  const style = (formData.get("style") as any) || 'academic';
  
  const totalCostStr = formData.get("totalCost") as string;
  const cost = parseInt(totalCostStr, 10);
  const addons = JSON.parse((formData.get("addons") as string) || "{}");
  const rawFiles = formData.getAll("files") as File[];
  
  // 🚀 프론트엔드에서 보낸 원문 텍스트 (RAG 용도)
  const sourceText = (formData.get("sourceText") as string) || "";

  if (!userId || rawFiles.length === 0) return { success: false, message: "분석할 파일이 없습니다." };

  const userRef = doc(db, "users", userId);
  const isMulti = rawFiles.length > 1;
  let isFirstFree = false;

  try {
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("유저 정보를 찾을 수 없습니다.");
      const currentInk = userSnap.data().inkBalance || 0;
      isFirstFree = !isMulti && (userSnap.data().hasFreeTrial === true || !userSnap.data().analysisCount || userSnap.data().analysisCount === 0);

      if (!isFirstFree && currentInk < cost) throw new Error(`잉크가 부족합니다. (필요: ${cost} / 현재: ${currentInk})`);
      if (isFirstFree) transaction.update(userRef, { hasFreeTrial: false, holdingFreeTrial: true });
      else transaction.update(userRef, { inkBalance: increment(-cost), holdingInk: increment(cost) });
    });
  } catch (err: any) { return { success: false, message: err.message }; }

  let processedFiles;
  let storagePaths: string[] = []; 

  try {
    processedFiles = await Promise.all(rawFiles.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const decodedTitle = Buffer.from(file.name, 'latin1').toString('utf8');
      
      const filePath = `temp_papers/${userId}/${Date.now()}_${decodedTitle}`;
      const storageRef = ref(storage, filePath);
      await uploadBytes(storageRef, uint8Array, { contentType: file.type });
      storagePaths.push(filePath);

      return { base64, title: decodedTitle, mimeType: file.type, filePath };
    }));
  } catch (err) {
    await rollbackInk(userRef, isFirstFree, cost);
    return { success: false, message: "파일 서버 업로드 중 오류가 발생했습니다." };
  }

  try {
    let analysisPromise = isMulti 
      ? analyzeMultiDirect(processedFiles, style, addons)
      : analyzePDFDirect(processedFiles[0].base64, mode, style, addons);
      
    let visualizationPromise: Promise<any> = Promise.resolve(null); 
    if (addons.visualization) {
      visualizationPromise = extractVisualizationData(processedFiles);
    }

    const [analysisResult, visualizationData] = await Promise.all([analysisPromise, visualizationPromise]);

    // 🚀 [신규 추가] 생성된 결과물과 원문을 비교하여 인메모리 RAG 엔진으로 신뢰도 계산!
    const reliability = await calculateReliabilityIndicator(sourceText, analysisResult.summary);

    let finalVizData: any = visualizationData; 
    let refundAmount = 0;
    let refundReason = "";

    if (addons.visualization) {
      if (!finalVizData || !finalVizData.data_points || finalVizData.data_points.length === 0) {
        finalVizData = null; 
        if (!isFirstFree) {
          refundAmount = 5; 
          refundReason = "추출할 시각화 데이터가 없어 5 INK가 자동 환불되었습니다.";
        } else {
          refundReason = "추출할 시각화 데이터가 없었습니다. (무료 혜택 적용됨)";
        }
      }
    }

    const docId = await runTransaction(db, async (transaction) => {
      if (isFirstFree) {
        transaction.update(userRef, { holdingFreeTrial: false, analysisCount: increment(1) });
      } else {
        transaction.update(userRef, { 
          holdingInk: increment(-cost), 
          inkBalance: increment(refundAmount),
          analysisCount: increment(1) 
        });
      }

      const newDocRef = doc(collection(db, "knowledge_library"));
      transaction.set(newDocRef, {
        userId,
        title: isMulti ? `${processedFiles[0].title} 외 ${processedFiles.length - 1}건` : processedFiles[0].title,
        analysisResult: analysisResult.summary,
        visualizationData: finalVizData,
        reliability: reliability, // 🔑 수학적 신뢰도 객체 {direct, semantic} 저장
        mode,
        style,
        storagePaths, 
        originalCost: cost - refundAmount,
        createdAt: serverTimestamp(),
      });

      return newDocRef.id;
    });

    return { success: true, data: { docId, refundReason } };

  } catch (err: any) {
    console.error("🔥 AI 분석 실패, 잉크 원상 복구 실행:", err.message);
    await rollbackInk(userRef, isFirstFree, cost);
    return { success: false, message: `분석 서버 오류로 잉크가 안전하게 환불되었습니다. (${err.message})` };
  }
}
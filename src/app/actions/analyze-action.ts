"use server";

import { analyzePDFDirect, analyzeMultiDirect, extractVisualizationData, calculateReliabilityIndicator } from "@/services/gemini-service";
import { db, storage } from "@/lib/firebase";
import { doc, collection, serverTimestamp, runTransaction, increment, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";

// ✅ 서버에서 직접 비용 계산 (버그 3 수정: 클라이언트 totalCost 신뢰하지 않음)
const MODE_COST: Record<string, number> = { scan: 5, understand: 15, think: 25 };
const MULTI_BASE = 10;
const MULTI_PER_FILE: Record<string, number> = { scan: 3, understand: 8, think: 12 };
const ADDON_COST = { visualization: 5, deepKeyword: 5 };

function calcCost(mode: string, isMulti: boolean, fileCount: number, addons: any): number {
  const base = isMulti
    ? MULTI_BASE + fileCount * (MULTI_PER_FILE[mode] ?? 8)
    : (MODE_COST[mode] ?? 15);
  const addonTotal =
    (addons.visualization ? ADDON_COST.visualization : 0) +
    (addons.deepKeyword ? ADDON_COST.deepKeyword : 0);
  return base + addonTotal;
}

export async function runUnifiedAnalysisAction(formData: FormData) {
  const userId   = formData.get("userId") as string;
  const mode     = (formData.get("mode") as string) || "understand";
  const style    = (formData.get("style") as string) || "academic";
  const addons   = JSON.parse((formData.get("addons") as string) || "{}");
  const rawFiles = formData.getAll("files") as File[];
  const sourceText = (formData.get("sourceText") as string) || "";

  if (!userId || rawFiles.length === 0)
    return { success: false, message: "분석할 파일이 없습니다." };

  const userRef = doc(db, "users", userId);
  const isMulti = rawFiles.length > 1;

  // ✅ 버그 3 수정: 서버에서 직접 비용 계산
  const cost = calcCost(mode, isMulti, rawFiles.length, addons);

  let isFirstFree  = false;
  let holdingAmount = 0; // 실제로 holdingInk에 올라간 금액 (환불용)
  let refundReason = "";

  try {
    // ── Step 1. 잉크 선차감 트랜잭션 ─────────────────────────────
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("유저 정보를 찾을 수 없습니다.");

      const data = userSnap.data();
      const currentInk = data.inkBalance || 0;

      // ✅ 버그 2 수정: hasFreeTrial 단독 조건 (analysisCount OR 제거)
      isFirstFree = !isMulti && data.hasFreeTrial === true;

      if (!isFirstFree && currentInk < cost)
        throw new Error("잉크가 부족합니다.");

      if (isFirstFree) {
        // 무료권 소진 표시만 하고 잉크는 건드리지 않음
        transaction.update(userRef, { hasFreeTrial: false, holdingFreeTrial: true });
      } else {
        holdingAmount = cost;
        transaction.update(userRef, {
          inkBalance: increment(-cost),
          holdingInk: increment(cost),
        });
      }
    });

    // ── Step 2. 파일 업로드 ────────────────────────────────────────
    const processedFiles = await Promise.all(
      rawFiles.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const filePath = `temp_papers/${userId}/${Date.now()}_${file.name}`;
        await uploadBytes(
          ref(storage, filePath),
          new Uint8Array(arrayBuffer),
          { contentType: file.type }
        );
        return { base64, title: file.name, mimeType: file.type, filePath };
      })
    );

    // ── Step 3. AI 분석 + 시각화 병렬 ────────────────────────────
    const [analysisResult, visualizationData] = await Promise.all([
      isMulti
        ? analyzeMultiDirect(processedFiles, style as any, addons)
        : analyzePDFDirect(processedFiles[0].base64, mode as any, style as any, addons),
      addons.visualization
        ? extractVisualizationData(processedFiles)
        : Promise.resolve(null),
    ]);

    // ── Step 4. 시각화 환불 검증 ─────────────────────────────────
    let finalVizData  = visualizationData;
    let actualRefund  = 0;
    if (
      addons.visualization &&
      (!visualizationData?.data_points?.length)
    ) {
      finalVizData  = null;
      actualRefund  = ADDON_COST.visualization;
      refundReason  = `추출할 시각화 데이터가 없어 ${actualRefund} INK가 자동 환불되었습니다.`;
    }

    // ── Step 5. 신뢰도 산출 ──────────────────────────────────────
    const reliability = await calculateReliabilityIndicator(
      sourceText,
      analysisResult.summary
    );

    // ── Step 6. 최종 저장 + holdingInk 해소 ─────────────────────
    const docId = await runTransaction(db, async (transaction) => {
      transaction.update(userRef, {
        holdingInk: 0,
        holdingFreeTrial: false,
        inkBalance: increment(actualRefund), // 환불분만 복원
        analysisCount: increment(1),
      });

      const newDocRef  = doc(collection(db, "knowledge_library"));
      const storagePaths = processedFiles.map((f) => f.filePath);
      const fileDeletedAt = new Date(Date.now() + 60 * 60 * 1000);

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
        inkCost: cost - actualRefund,
        isFavorite: false,
        memos: [],
        chatHistory: [],
        styleChangedCount: 0,        // ✅ 스타일 전환 횟수 추적용
        fileDeletedAt,
        isSourceDeleted: false,
        createdAt: serverTimestamp(),
      });

      return newDocRef.id;
    });

    return { success: true, data: { docId, refundReason } };

  } catch (err: any) {
    // ✅ 버그 1 수정: 에러 시 holdingInk 전액 환불
    try {
      if (holdingAmount > 0) {
        await updateDoc(userRef, {
          inkBalance: increment(holdingAmount),
          holdingInk:  0,
        });
      }
      // 무료권도 복원
      if (isFirstFree) {
        await updateDoc(userRef, {
          hasFreeTrial:   true,
          holdingFreeTrial: false,
        });
      }
    } catch {
      // 환불 자체 실패 시 무시 (운영 로그로 관리)
      console.error("❌ INK 환불 실패 — 수동 처리 필요:", userId, holdingAmount);
    }

    return { success: false, message: err.message };
  }
}

// 관점 재분석 (별도 파일로 분리되어 있어 여기선 유지)
export async function reAnalyzeAction(
  docId: string,
  perspective: string,
  userId: string
) {
  try {
    const userRef = doc(db, "users", userId);
    const docRef  = doc(db, "knowledge_library", docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error("원본 기록을 찾을 수 없습니다.");

    const reAnalysisCost = 8;

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if ((userSnap.data()?.inkBalance || 0) < reAnalysisCost)
        throw new Error("잉크가 부족합니다.");
      transaction.update(userRef, { inkBalance: increment(-reAnalysisCost) });
    });

    return { success: true, data: { newDocId: docId, cost: reAnalysisCost } };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
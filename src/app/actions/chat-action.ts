"use server";

import { chatWithPaper } from "@/services/gemini-service";
import { db, storage } from "@/lib/firebase";
import {
  doc, getDoc, updateDoc, increment, arrayUnion,
} from "firebase/firestore";
import { ref, getBytes } from "firebase/storage";

const CHAT_INK_COST = 2; // 채팅 1회 = 2 INK

export async function sendChatMessageAction(
  docId: string,
  userId: string,
  userQuestion: string,
  chatHistory: { role: "user" | "assistant"; content: string }[],
  style: "academic" | "lecture" | "blog" = "academic"
) {
  if (!userQuestion.trim()) return { success: false, message: "질문을 입력해주세요." };

  try {
    const userRef = doc(db, "users", userId);
    const docRef  = doc(db, "knowledge_library", docId);

    const [userSnap, docSnap] = await Promise.all([
      getDoc(userRef),
      getDoc(docRef),
    ]);
    if (!docSnap.exists()) return { success: false, message: "분석 기록을 찾을 수 없습니다." };
    if (docSnap.data().userId !== userId) return { success: false, message: "권한이 없습니다." };

    const currentInk = userSnap.data()?.inkBalance || 0;
    if (currentInk < CHAT_INK_COST)
      return { success: false, message: `잉크가 부족합니다. (채팅 1회 = ${CHAT_INK_COST} INK)` };

    // PDF 원본 (1시간 내) 시도
    let base64Data: string | null = null;
    const storagePaths  = docSnap.data().storagePaths as string[] | undefined;
    const fileDeletedAt = docSnap.data().fileDeletedAt;
    const isDeleted =
      !fileDeletedAt ||
      (fileDeletedAt.toDate
        ? fileDeletedAt.toDate() < new Date()
        : new Date(fileDeletedAt.seconds * 1000) < new Date());

    if (!isDeleted && storagePaths?.length) {
      try {
        const buf  = await getBytes(ref(storage, storagePaths[0]));
        base64Data = Buffer.from(buf).toString("base64");
      } catch {
        // 원본 없으면 분석 컨텍스트만 사용
      }
    }

    const analysisContext = docSnap.data().analysisResult || "";
    const answer = await chatWithPaper(
      base64Data,
      analysisContext,
      chatHistory.slice(-6),
      userQuestion,
      style
    );

    await Promise.all([
      updateDoc(userRef, { inkBalance: increment(-CHAT_INK_COST) }),
      updateDoc(docRef, {
        chatHistory: arrayUnion(
          { role: "user",      content: userQuestion, createdAt: new Date().toISOString() },
          { role: "assistant", content: answer,        createdAt: new Date().toISOString() }
        ),
        totalChatCost: increment(CHAT_INK_COST),
      }),
    ]);

    return { success: true, answer, inkCost: CHAT_INK_COST };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

// ✅ 스타일 재렌더링 — 1회 무료, 이후 2 INK
const RESTYLE_FREE_COUNT = 1;
const RESTYLE_INK_COST   = 2;

export async function restyleAnalysisAction(
  docId: string,
  userId: string,
  newStyle: "academic" | "lecture" | "blog"
) {
  try {
    const userRef = doc(db, "users", userId);
    const docRef  = doc(db, "knowledge_library", docId);

    const [userSnap, docSnap] = await Promise.all([
      getDoc(userRef),
      getDoc(docRef),
    ]);
    if (!docSnap.exists() || docSnap.data().userId !== userId)
      return { success: false, message: "권한이 없습니다." };

    const usedCount: number = docSnap.data().styleChangedCount ?? 0;
    const isFreeRestyle     = usedCount < RESTYLE_FREE_COUNT;
    const inkCost           = isFreeRestyle ? 0 : RESTYLE_INK_COST;

    // 유료 전환 시 잉크 검사
    if (!isFreeRestyle) {
      const currentInk = userSnap.data()?.inkBalance || 0;
      if (currentInk < inkCost)
        return {
          success: false,
          message: `스타일 전환은 1회 무료, 이후 ${RESTYLE_INK_COST} INK입니다. 잉크가 부족합니다.`,
          inkRequired: inkCost,
        };
    }

    const { restyleAnalysis } = await import("@/services/gemini-service");
    const newText = await restyleAnalysis(
      docSnap.data().analysisResult || "",
      newStyle
    );

    // INK 차감 + 전환 횟수 증가 동시 처리
    await Promise.all([
      inkCost > 0
        ? updateDoc(userRef, { inkBalance: increment(-inkCost) })
        : Promise.resolve(),
      updateDoc(docRef, {
        styleChangedCount: increment(1),
        lastStyle: newStyle,
      }),
    ]);

    return {
      success: true,
      newText,
      inkCost,
      isFreeRestyle,
      remainingFree: Math.max(0, RESTYLE_FREE_COUNT - usedCount - 1),
    };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
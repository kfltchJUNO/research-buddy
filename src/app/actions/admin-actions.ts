"use server";

import { db } from "@/lib/firebase";
import { doc, runTransaction, serverTimestamp, increment } from "firebase/firestore";

export async function approveInkRequest(requestId: string, userId: string, amount: number) {
  // 1. 참조 생성
  const requestRef = doc(db, "ink_requests", requestId);
  const userRef = doc(db, "users", userId);

  try {
    return await runTransaction(db, async (transaction) => {
      const requestSnap = await transaction.get(requestRef);
      const userSnap = await transaction.get(userRef);

      // 2. 검증 로직
      if (!requestSnap.exists()) throw new Error("존재하지 않는 요청입니다.");
      if (requestSnap.data().status !== "pending") throw new Error("이미 처리된 요청입니다.");
      if (!userSnap.exists()) throw new Error("대상 유저를 찾을 수 없습니다.");

      // 3. 업데이트 수행
      // 숫자가 아닌 값이 들어올 경우를 대비해 Number()로 강제 형변환
      const inkToAdd = Number(amount);
      if (isNaN(inkToAdd)) throw new Error("지급액이 올바르지 않습니다.");

      transaction.update(requestRef, { 
        status: "approved", 
        processedAt: serverTimestamp() 
      });

      transaction.update(userRef, { 
        inkBalance: increment(inkToAdd) 
      });

      return { success: true as const };
    });
  } catch (error: any) {
    console.error("❌ Approval Error:", error.message);
    return { success: false as const, message: error.message || "지급 실패" };
  }
}
"use server";

import { db } from "@/lib/firebase";
import { 
  doc, 
  runTransaction, 
  serverTimestamp, 
  collection, 
  getDocs, 
  query, 
  where,
  getCountFromServer
} from "firebase/firestore";

/**
 * [관리자] 충전 요청 승인 및 잉크 지급
 */
export async function approveInkRequest(requestId: string, userId: string, amount: number) {
  const requestRef = doc(db, "ink_requests", requestId);
  const userRef = doc(db, "users", userId);

  try {
    await runTransaction(db, async (transaction) => {
      const requestSnap = await transaction.get(requestRef);
      if (!requestSnap.exists() || requestSnap.data().status !== "pending") {
        throw new Error("이미 처리되었거나 존재하지 않는 요청입니다.");
      }

      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("사용자를 찾을 수 없습니다.");

      // 1. 요청 상태 업데이트
      transaction.update(requestRef, {
        status: "approved",
        processedAt: serverTimestamp(),
      });

      // 2. 유저 잉크 잔액 증액
      const currentBalance = userSnap.data().inkBalance || 0;
      transaction.update(userRef, {
        inkBalance: currentBalance + amount
      });
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

/**
 * [관리자] 전체 유저 목록 및 분석 통계 가져오기
 */
export async function getUsersWithStats() {
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    
    const usersWithStats = await Promise.all(
      usersSnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data();
        
        // 해당 유저의 분석 횟수 집계 (knowledge_library 컬렉션 쿼리)
        const libraryQuery = query(
          collection(db, "knowledge_library"),
          where("userId", "==", userDoc.id)
        );
        const countSnapshot = await getCountFromServer(libraryQuery);
        
        return {
          id: userDoc.id,
          ...userData,
          analysisCount: countSnapshot.data().count,
        };
      })
    );

    return { success: true, data: usersWithStats };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
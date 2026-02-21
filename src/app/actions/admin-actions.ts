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
  getCountFromServer, 
  increment 
} from "firebase/firestore";

/**
 * [관리자] 충전 승인 처리 (트랜잭션 최적화)
 */
export async function approveInkRequest(requestId: string, userId: string, amount: number) {
  const requestRef = doc(db, "ink_requests", requestId);
  const userRef = doc(db, "users", userId);

  try {
    return await runTransaction(db, async (transaction) => {
      const requestSnap = await transaction.get(requestRef);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists()) throw new Error("지급 대상 유저를 찾을 수 없습니다.");
      if (!requestSnap.exists() || requestSnap.data().status !== "pending") {
        throw new Error("이미 처리되었거나 존재하지 않는 요청입니다.");
      }

      transaction.update(requestRef, { 
        status: "approved", 
        processedAt: serverTimestamp() 
      });

      transaction.update(userRef, { 
        inkBalance: increment(amount) 
      });

      return { success: true as const };
    });
  } catch (error: any) {
    return { success: false as const, message: error.message || "승인 처리 중 오류 발생" };
  }
}

/**
 * [관리자] 유저 목록 및 분석 통계 실시간 집계 (수출 확인)
 */
export async function getUsersWithStats() {
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    
    // 만약 여기서도 에러가 난다면 보안 규칙의 'allow list' 문제임
    if (usersSnapshot.empty) return { success: true, data: [] };

    const usersWithStats = await Promise.all(
      usersSnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data();
        // 각 유저의 분석 횟수를 가져옵니다.
        const libraryQuery = query(collection(db, "knowledge_library"), where("userId", "==", userDoc.id));
        const countSnapshot = await getCountFromServer(libraryQuery);
        
        return {
          id: userDoc.id,
          nickname: userData.nickname || "익명 연구자",
          inkBalance: userData.inkBalance || 0,
          role: userData.role || "user",
          email: userData.email || "-",
          analysisCount: countSnapshot.data().count,
          lastLogin: userData.lastLoginAt || null 
        };
      })
    );

    return { success: true, data: usersWithStats };
  } catch (error: any) {
    // 7 PERMISSION_DENIED가 콘솔에 찍히는지 확인
    console.error("❌ 유저 목록 취득 실패:", error.code, error.message);
    return { success: false, message: `권한 오류: ${error.message}` };
  }
}
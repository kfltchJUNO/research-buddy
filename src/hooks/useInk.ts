"use client";

import { useEffect, useState, useRef } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import toast from "react-hot-toast";

export function useInk() {
  const [inkBalance, setInkBalance] = useState<number>(0);
  const prevInkRef = useRef<number | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 사용자 문서 실시간 감시
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (doc) => {
      if (doc.exists()) {
        const newBalance = doc.data().inkBalance || 0;

        // 1. 잉크가 이전보다 늘어났을 때만 알림 발생
        if (prevInkRef.current !== null && newBalance > prevInkRef.current) {
          const addedAmount = newBalance - prevInkRef.current;
          toast.success(`잉크 충전 완료! 🖋️ +${addedAmount}`, {
            duration: 4000,
            position: "top-center",
            style: {
              borderRadius: "100px",
              background: "#333",
              color: "#fff",
              fontSize: "14px",
              fontWeight: "bold",
            },
          });
        }

        // 2. 상태 업데이트 및 이전 값 저장
        setInkBalance(newBalance);
        prevInkRef.current = newBalance;
      }
    });

    return () => unsubscribe();
  }, []);

  return inkBalance;
}
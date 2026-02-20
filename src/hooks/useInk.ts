"use client";

import { useEffect, useState, useRef } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import toast from "react-hot-toast";

export function useInk() {
  const [inkBalance, setInkBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const prevInkRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setInkBalance(0);
        setIsLoading(false);
        return;
      }

      const unsubscribeSnap = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const newBalance = docSnap.data().inkBalance || 0;

          // 잉크가 이전보다 늘어났을 때만 알림 발생 (원본 로직 유지)
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

          setInkBalance(newBalance);
          prevInkRef.current = newBalance;
        }
        setIsLoading(false);
      });

      return () => unsubscribeSnap();
    });

    return () => unsubscribeAuth();
  }, []);

  return { inkBalance, isLoading };
}
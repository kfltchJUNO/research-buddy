// src/lib/admin-check.ts
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export async function isAdmin(uid: string) {
  const userSnap = await getDoc(doc(db, "users", uid));
  return userSnap.exists() && userSnap.data().role === "admin";
}
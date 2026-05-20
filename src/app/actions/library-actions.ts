// src/app/actions/library-actions.ts
"use server";

import { db, storage } from "@/lib/firebase";
import {
  doc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";

// 1. 완전 삭제 (DB + Storage 동시 파기)
export async function deleteDocumentAction(docId: string, storagePaths: string[]) {
  try {
    if (storagePaths && storagePaths.length > 0) {
      for (const path of storagePaths) {
        try {
          const fileRef = ref(storage, path);
          await deleteObject(fileRef);
        } catch {
          // 이미 파기된 파일은 무시
        }
      }
    }
    await deleteDoc(doc(db, "knowledge_library", docId));
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// 2. 폴더 이동
export async function updateDocFolderAction(docId: string, folderName: string) {
  try {
    await updateDoc(doc(db, "knowledge_library", docId), { folder: folderName });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// 3. 태그 추가/삭제
export async function updateDocTagsAction(
  docId: string,
  tag: string,
  action: "add" | "remove"
) {
  try {
    const docRef = doc(db, "knowledge_library", docId);
    if (action === "add") {
      await updateDoc(docRef, { tags: arrayUnion(tag) });
    } else {
      await updateDoc(docRef, { tags: arrayRemove(tag) });
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// 4. 유저 폴더 생성
export async function createUserFolderAction(userId: string, folderName: string) {
  try {
    await updateDoc(doc(db, "users", userId), {
      customFolders: arrayUnion(folderName),
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ✅ 5. 즐겨찾기 토글 (신규 - 보완 #1)
export async function toggleFavoriteAction(docId: string, current: boolean) {
  try {
    await updateDoc(doc(db, "knowledge_library", docId), {
      isFavorite: !current,
    });
    return { success: true, isFavorite: !current };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ✅ 6. 메모 추가 (신규 - 보완 #6)
export async function addMemoAction(docId: string, memoText: string, userId: string) {
  try {
    const docRef = doc(db, "knowledge_library", docId);
    const snap = await getDoc(docRef);
    if (!snap.exists() || snap.data().userId !== userId)
      throw new Error("권한이 없습니다.");
    const memo = {
      id: `memo_${Date.now()}`,
      text: memoText,
      createdAt: new Date().toISOString(),
    };
    await updateDoc(docRef, { memos: arrayUnion(memo) });
    return { success: true, memo };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ✅ 7. 메모 삭제 (신규 - 보완 #6)
export async function deleteMemoAction(docId: string, memo: any, userId: string) {
  try {
    const docRef = doc(db, "knowledge_library", docId);
    const snap = await getDoc(docRef);
    if (!snap.exists() || snap.data().userId !== userId)
      throw new Error("권한이 없습니다.");
    await updateDoc(docRef, { memos: arrayRemove(memo) });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ✅ 8. 결과 공유 링크 생성 (신규 - 보완 #9)
// 공유용 별도 컬렉션에 복사본 저장 (만료 7일)
export async function createShareLinkAction(docId: string, userId: string) {
  try {
    const docRef = doc(db, "knowledge_library", docId);
    const snap = await getDoc(docRef);
    if (!snap.exists() || snap.data().userId !== userId)
      throw new Error("권한이 없습니다.");

    const shareId = `share_${docId}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일

    await setDoc(doc(db, "shared_analyses", shareId), {
      originalDocId: docId,
      title: snap.data().title,
      analysisResult: snap.data().analysisResult,
      mode: snap.data().mode,
      reliability: snap.data().reliability,
      kciData: snap.data().kciData || null,
      createdBy: userId,
      expiresAt,
      viewCount: 0,
      createdAt: serverTimestamp(),
    });

    await updateDoc(docRef, { shareId, shareExpiresAt: expiresAt });
    return { success: true, shareId };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ✅ 9. INK 차감 내역 기록 (신규 - 보완 #12)
export async function recordInkUsageAction(
  userId: string,
  docId: string,
  cost: number,
  mode: string,
  title: string
) {
  try {
    await updateDoc(doc(db, "knowledge_library", docId), { inkCost: cost });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
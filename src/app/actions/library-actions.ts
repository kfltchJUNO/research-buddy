// src/app/actions/library-actions.ts
"use server";

import { db, storage } from "@/lib/firebase";
import { doc, deleteDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";

// 🚀 1. 완전 삭제 (Garbage Collection: DB + Storage 동시 파기)
export async function deleteDocumentAction(docId: string, storagePaths: string[]) {
  try {
    // 1단계: 연결된 원본 PDF 파일이 스토리지에 남아있다면 영구 삭제
    if (storagePaths && storagePaths.length > 0) {
      for (const path of storagePaths) {
        try {
          const fileRef = ref(storage, path);
          await deleteObject(fileRef);
          console.log(`🗑️ 스토리지 원본 파일 영구 삭제 완료: ${path}`);
        } catch (storageErr: any) {
          // 파일이 이미 1시간 지나서 지워졌거나 없으면 자연스럽게 무시합니다.
          console.log(`ℹ️ 스토리지 파일 없음 (이미 파기됨): ${path}`);
        }
      }
    }
    
    // 2단계: DB에서 분석 결과 문서 삭제
    await deleteDoc(doc(db, "knowledge_library", docId));
    return { success: true };
  } catch (error: any) {
    console.error("🔥 완전 삭제 실패:", error);
    return { success: false, message: error.message };
  }
}

// 🚀 2. 폴더 이동 (Drag & Drop 용도)
export async function updateDocFolderAction(docId: string, folderName: string) {
  try {
    const docRef = doc(db, "knowledge_library", docId);
    await updateDoc(docRef, { folder: folderName });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// 🚀 3. 태그 추가/삭제
export async function updateDocTagsAction(docId: string, tag: string, action: 'add' | 'remove') {
  try {
    const docRef = doc(db, "knowledge_library", docId);
    if (action === 'add') {
      await updateDoc(docRef, { tags: arrayUnion(tag) });
    } else {
      await updateDoc(docRef, { tags: arrayRemove(tag) });
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// 🚀 4. 유저의 새 폴더 생성 (users 컬렉션에 배열로 저장)
export async function createUserFolderAction(userId: string, folderName: string) {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { customFolders: arrayUnion(folderName) });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // auth 기능을 가져옵니다.
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 앱이 이미 초기화되었는지 확인 후 초기화
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 핵심: 'auth'를 정확히 export 해야 합니다.
export const auth = getAuth(app); 
export const db = getFirestore(app);
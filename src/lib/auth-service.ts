import { GoogleAuthProvider, signInWithPopup, User } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

// 랜덤 닉네임 생성기 (예: 연구자A12)
const generateRandomNickname = () => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
  const randomNumber = Math.floor(Math.random() * 90) + 10; // 10-99
  return `연구자${randomLetter}${randomNumber}`;
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    // Firestore에 유저 정보가 있는지 확인
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // 신규 유저라면 문서 자동 생성 (준호님의 스키마 반영)
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        nickname: generateRandomNickname(),
        inkBalance: 0, // 초기 잉크
        isTrialUsed: false,
        role: "user",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      });
    } else {
      // 기존 유저라면 마지막 로그인 시간만 업데이트
      await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
    }
    return user;
  } catch (error) {
    console.error("Login Error:", error);
    throw error;
  }
};
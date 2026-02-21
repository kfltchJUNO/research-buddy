import { auth, db } from "./firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

const generateResearcherNickname = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randChars = chars[Math.floor(Math.random()*26)] + chars[Math.floor(Math.random()*26)];
  const randNums = Math.floor(Math.random()*900) + 100;
  return `연구자${randChars}${randNums}`;
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const ADMIN_EMAIL = "ot.helper7@gmail.com";

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    const isTargetAdmin = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    if (!userSnap.exists()) {
      // 신규 가입: 잉크 0, 무료체험권 1회 부여
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        nickname: generateResearcherNickname(),
        role: isTargetAdmin ? "admin" : "user",
        inkBalance: 0, 
        hasFreeTrial: true, // 최초 1회 무료 분석용 플래그
        analysisCount: 0,
        createdAt: new Date(),
      });
    } else {
      // 기존 유저가 관리자 이메일인 경우 권한 강제 업데이트
      if (isTargetAdmin && userSnap.data().role !== "admin") {
        await updateDoc(userRef, { role: "admin" });
      }
    }
    window.location.href = "/library";
  } catch (error) {
    console.error("Login Error:", error);
  }
};
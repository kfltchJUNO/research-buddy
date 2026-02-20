"use client";

import { useEffect, useState } from "react";
// 오류 수정: 파일 경로를 detector에서 detect-inapp으로, 함수명을 isInAppBrowser로 변경
import { isInAppBrowser } from "@/lib/detect-inapp"; 
import { signInWithGoogle } from "@/lib/auth-service";

export default function LoginButton() {
  const [isInApp, setIsInApp] = useState(false);

  useEffect(() => {
    // 실제 정의된 함수인 isInAppBrowser()를 호출합니다.
    setIsInApp(isInAppBrowser());
  }, []);

  const handleCopyUrl = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      alert("주소가 복사되었습니다! 크롬이나 사파리 앱을 열어 붙여넣어 주세요.");
    }
  };

  if (isInApp) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-[2rem] text-center shadow-sm">
        <div className="text-3xl mb-3">⚠️</div>
        <p className="text-sm text-yellow-800 font-bold mb-4 leading-relaxed">
          인앱 브라우저(카카오/인스타 등)에서는<br/>
          구글 로그인이 제한될 수 있습니다.
        </p>
        <button 
          onClick={handleCopyUrl}
          className="w-full py-4 bg-yellow-400 text-yellow-900 rounded-2xl font-black active:scale-95 transition-all shadow-md"
        >
          주소 복사하고 외부 브라우저로 가기
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={signInWithGoogle}
      className="flex items-center justify-center gap-3 w-full py-4 bg-white border-2 border-gray-100 rounded-2xl hover:border-violet-600 hover:bg-violet-50 transition-all group active:scale-95"
    >
      <img src="/google-icon.svg" alt="Google" className="w-6 h-6 group-hover:rotate-12 transition-transform" />
      <span className="font-bold text-gray-700">구글 계정으로 시작하기</span>
    </button>
  );
}